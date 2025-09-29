const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors");

// 결과 형식을 객체로 설정 (권장)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// 데이터베이스 연결 정보 (환경 변수로 분리하는 것을 권장)
const dbConfig = {
  user: 'scott',
  password: 'tiger',
  connectString: 'localhost:1521/xe',
  poolMin: 10,
  poolMax: 10,
  poolIncrement: 0,
  poolAlias: "APP_POOL" //풀 이름 지정
};

// oracle DB 연결 풀 초기화 함수
async function initialize() {
  try {
    await oracledb.createPool(dbConfig); //원래 비동기방식, await로 동기방식 변경
    console.log('연결성공');
  } catch (err) {
    //예외발생
    console.log('연결실패');
    process.exit(1); //연결 실패 시 서버 종료
  }
};

const app = express();
app.use(cors());
app.use(express.json());

// nodemon test...

app.get("/", (req, res) => {
  res.send('Root 페이지가 요청');
});

app.post('/emp', async (req, res) => {
  // res.send("Root 페이지가 요청");
  console.log(req.body)
  let connection;
  try {
    //풀 이름으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    //SQL 쿼리 실행
    const result = await connection.execute(`insert into emp(empno, ename, job, hiredate, deptno)
values (${req.body.eno}, '${req.body.ename}', '${req.body.job}', to_date('${req.body.hd}', 'rrrr-mm-dd'), ${req.body.deptno})`);
    //조회된 데이터를 json 형식으로 응답

    await connection.commit();
    res.status(200).json(result);
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).json({
      error: "데이터 조회중 오류가 발생했습니다.",
      detail: err.message,
    })
  } finally {
    if (connection) {
      try {
        await connection.close();

      } catch (err) {
        console.log(`error closing connection`, err);
      }
    }
  }
});

//사원삭제
app.get('/emp/:eno', async (req, res) => {
  console.log(req.params.eno);
  let empno = req.params.eno;
  let connection;
  try {
    // 풀 이름으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // SQL쿼리 실행
    const result = await connection.execute(`DELETE FROM emp WHERE empno = ${empno}`);
    console.log(result);
    await connection.commit();

    // 조회된 데이터를 JSON 형식으로 응답
    res.status(200).json(result);
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).json({
      error: "데이터 조회 중 오류가 발생했습니다",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        //커넥션 반환
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
})

// 사원 목록
app.get("/emp/:ename/:job/:deptno", async (req, res) => {
  console.log(req.params);
  const ename = req.params.ename;
  const job = req.params.job;
  const deptno = req.params.deptno;

  let connection;
  try {
    // 풀 이름으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    const sql = `SELECT *
     FROM EMP_DEPT_V
     WHERE ename = DECODE('${ename}','ALL', ename, '${ename}')
     AND job = DECODE('${job}', 'ALL', job, '${job}')
     AND deptno = DECODE(${deptno}, '-1', deptno, ${deptno})`;
    // SQL쿼리 실행
    const result = await connection.execute(sql);
    console.log(result);

    // 조회된 데이터를 JSON 형식으로 응답
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).json({
      error: "데이터 조회 중 오류가 발생했습니다",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        //커넥션 반환
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

const port = 3000;

// 서버 시작 전에 initialize()를 완료하고, 성공 했을 때만 listen() 실행
async function startServer() {
  await initialize();
  app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
  });
}

startServer();