import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join('/home/user/Gamely', 'game.db')

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contestants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team TEXT NOT NULL CHECK(team IN ('A','B','WILD')),
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
  `)

  // Insert default questions if table is empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as { cnt: number }
  if (count.cnt === 0) {
    const insertQuestion = db.prepare('INSERT INTO questions (text) VALUES (?)')
    const defaultQuestions = [
      'ما هو تاريخ ميلادك؟',
      'ما هو لونك المفضل؟',
      'ما هو معدلك في الثانوية العامة؟',
      'ما اسم أفضل أصدقائك؟',
      'ما هي وجبتك المفضلة؟',
      'أي دولة تتمنى زيارتها أكثر؟',
      'ما هي آيتك المفضلة من القرآن الكريم؟',
      'أي سورة تستمتع بسماعها أكثر؟',
      'ما هو مقاس حذائك؟',
      'إذا حصلت على مليون دينار بحريني فجأة، ماذا ستفعل أولاً؟',
    ]
    const insertMany = db.transaction((questions: string[]) => {
      for (const q of questions) {
        insertQuestion.run(q)
      }
    })
    insertMany(defaultQuestions)
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
