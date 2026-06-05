import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'game.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initDb(_db)
  }
  return _db
}

function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      personalized_template TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contestants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team TEXT NOT NULL CHECK(team IN ('A','B','WILD','UNASSIGNED')) DEFAULT 'UNASSIGNED',
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contestant_id INTEGER NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contestant_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT 'idle' CHECK(status IN ('idle','wagering','questioning','result','finished')),
      current_team TEXT DEFAULT 'A' CHECK(current_team IN ('A','B')),
      team_a_score INTEGER DEFAULT 1000,
      team_b_score INTEGER DEFAULT 1000,
      team_a_removes_used INTEGER DEFAULT 0,
      team_b_removes_used INTEGER DEFAULT 0,
      current_state TEXT DEFAULT '{}',
      last_question_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS used_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES game_sessions(id),
      contestant_id INTEGER NOT NULL REFERENCES contestants(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      UNIQUE(session_id, contestant_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS wild_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      wrong_answer_1 TEXT NOT NULL,
      wrong_answer_2 TEXT NOT NULL,
      wrong_answer_3 TEXT NOT NULL,
      wrong_answer_4 TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_player_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contestant_id INTEGER NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      wrong_answer_1 TEXT NOT NULL,
      wrong_answer_2 TEXT NOT NULL,
      wrong_answer_3 TEXT NOT NULL,
      wrong_answer_4 TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_wrong_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contestant_id INTEGER NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      wrong_answer TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contestant_id, question_id, wrong_answer)
    );
  `)

  // Migrate: add personalized_template column if not exists
  try {
    db.exec(`ALTER TABLE questions ADD COLUMN personalized_template TEXT`)
  } catch { /* already exists */ }

  // Migrate: add new game_sessions columns
  const gameMigrations = [
    `ALTER TABLE game_sessions ADD COLUMN wager_usage TEXT DEFAULT '{}'`,
    `ALTER TABLE game_sessions ADD COLUMN steal_used_a INTEGER DEFAULT 0`,
    `ALTER TABLE game_sessions ADD COLUMN steal_used_b INTEGER DEFAULT 0`,
    `ALTER TABLE game_sessions ADD COLUMN used_question_topics TEXT DEFAULT '[]'`,
  ]
  for (const sql of gameMigrations) {
    try { db.exec(sql) } catch { /* already exists */ }
  }

  // Migrate: add reverse_template to questions and wager range to custom_player_questions
  try { db.exec(`ALTER TABLE questions ADD COLUMN reverse_template TEXT`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE custom_player_questions ADD COLUMN min_wager INTEGER DEFAULT 0`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE custom_player_questions ADD COLUMN max_wager INTEGER DEFAULT 1000`) } catch { /* already exists */ }

  // Migrate: update team CHECK to allow UNASSIGNED (SQLite doesn't support ALTER COLUMN CHECK easily, skip)

  // Insert default questions if table is empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as { cnt: number }
  if (count.cnt === 0) {
    const insertQuestion = db.prepare('INSERT INTO questions (text, personalized_template) VALUES (?, ?)')
    const defaultQuestions: [string, string][] = [
      ['ما هو تاريخ ميلادك؟', 'ما هو تاريخ ميلاد {name}؟'],
      ['ما هو لونك المفضل؟', 'ما هو اللون المفضل لـ{name}؟'],
      ['ما هو معدلك في الثانوية العامة؟', 'ما هو معدل {name} في الثانوية العامة؟'],
      ['ما اسم أفضل أصدقائك؟', 'ما اسم أفضل أصدقاء {name}؟'],
      ['ما هي وجبتك المفضلة؟', 'ما هي الوجبة المفضلة لـ{name}؟'],
      ['أي دولة تتمنى زيارتها أكثر؟', 'أي دولة يتمنى {name} زيارتها أكثر؟'],
      ['ما هي آيتك المفضلة من القرآن الكريم؟', 'ما هي الآية المفضلة لـ{name} من القرآن الكريم؟'],
      ['أي سورة تستمتع بسماعها أكثر؟', 'أي سورة يستمتع {name} بسماعها أكثر؟'],
      ['ما هو مقاس حذائك؟', 'ما هو مقاس حذاء {name}؟'],
      ['إذا حصلت على مليون دينار بحريني فجأة، ماذا ستفعل أولاً؟', 'إذا حصل {name} على مليون دينار بحريني فجأة، ماذا سيفعل أولاً؟'],
    ]
    const insertMany = db.transaction((questions: [string, string][]) => {
      for (const [text, template] of questions) {
        insertQuestion.run(text, template)
      }
    })
    insertMany(defaultQuestions)
  } else {
    // Backfill personalized_template for existing default questions
    const defaultTemplates: Record<number, string> = {
      1: 'ما هو تاريخ ميلاد {name}؟',
      2: 'ما هو اللون المفضل لـ{name}؟',
      3: 'ما هو معدل {name} في الثانوية العامة؟',
      4: 'ما اسم أفضل أصدقاء {name}؟',
      5: 'ما هي الوجبة المفضلة لـ{name}؟',
      6: 'أي دولة يتمنى {name} زيارتها أكثر؟',
      7: 'ما هي الآية المفضلة لـ{name} من القرآن الكريم؟',
      8: 'أي سورة يستمتع {name} بسماعها أكثر؟',
      9: 'ما هو مقاس حذاء {name}؟',
      10: 'إذا حصل {name} على مليون دينار بحريني فجأة، ماذا سيفعل أولاً؟',
    }
    for (const [id, template] of Object.entries(defaultTemplates)) {
      db.prepare('UPDATE questions SET personalized_template = ? WHERE id = ? AND personalized_template IS NULL')
        .run(template, parseInt(id))
    }
  }

  // Insert default settings if not present
  const defaultSettings: Record<string, object> = {
    helpline_remove_two: { cost: 50, multiplier_reduction: 0.25 },
    helpline_same_person: { cost: 100, multiplier_reduction: 0.5 },
    helpline_opposing_team: { cost: 75, multiplier_reduction: 0.5 },
    helpline_wild: { cost: 200, multiplier_reduction: 0.5 },
  }
  const upsertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, val] of Object.entries(defaultSettings)) {
    upsertSetting.run(key, JSON.stringify(val))
  }
}

export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const database = getDb()
    const value = (database as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(database)
    }
    return value
  }
})

export default db
