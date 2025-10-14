const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

// 저장 위치 및 파일명 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../web-master/public/js/project/img")); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 결과 형식을 객체로 설정 (권장)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// 데이터베이스 연결 정보 (환경 변수로 분리하는 것을 권장)
const dbConfig = {
  user: 'hr',
  password: 'hr',
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

// public 폴더를 절대경로로 지정
const staticPath = path.join(__dirname, "../../web-master/public");
app.use(express.static(staticPath));
console.log("Static folder:", staticPath);


// nodemon test...

app.get("/", (req, res) => {
  res.send('Root 페이지가 요청');
});


// 회원 등록
app.post('/user', async (req, res) => {
  console.log(req.body);
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 🔹 아이디 중복 확인
    const check = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM user_table WHERE userId = :id`,
      [req.body.userId]
    );

    if (check.rows[0][0] > 0) {
      return res.json({
        success: false,
        message: "이미 존재하는 아이디입니다."
      });
    }

    // 🔹 회원가입 (INSERT)
    const result = await connection.execute(
      `INSERT INTO user_table(userId, userPw, userName, userTel, userAddress)
       VALUES (:id, :pw, :name, :tel, :addr)`, {
        id: req.body.userId,
        pw: req.body.userPw,
        name: req.body.userName,
        tel: req.body.userTel,
        addr: req.body.userAddress
      }, {
        autoCommit: true
      }
    );

    // 🔹 결과 응답
    if (result.rowsAffected && result.rowsAffected > 0) {
      res.json({
        success: true
      });
    } else {
      res.json({
        success: false,
        message: "회원가입에 실패했습니다."
      });
    }

  } catch (err) {
    console.error("Error executing query", err);

    // PK 제약조건 오류(중복)일 경우
    if (err.message.includes("ORA-00001")) {
      return res.json({
        success: false,
        message: "이미 존재하는 아이디 또는 전화번호입니다."
      });
    }

    // 그 외 오류
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      detail: err.message,
    });

  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.log("error closing connection", err);
      }
    }
  }
});

// 로그인
app.post('/login', async (req, res) => {
  const { userId, userPw } = req.body;
  let connection;

  if (!userId || !userPw) {
    return res.status(400).json({
      success: false,
      message: "아이디와 비밀번호를 모두 입력해 주세요."
    });
  }

  try {
    // 풀 alias로 커넥션 획득
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 아이디로 조회 (비번/이름 함께 가져오기)
    const result = await connection.execute(
      `SELECT userPw, userName
         FROM user_table
        WHERE userId = :id`,
      { id: userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      // 아이디 없음
      return res.json({
        success: false,
        message: "존재하지 않는 아이디입니다."
      });
    }

    const row   = result.rows[0];
    const dbPw  = (row.USERPW || "").trim();     // 혹시 모를 공백 제거
    const name  = (row.USERNAME || "").trim();

    if (dbPw === userPw) {
      // ✅ 로그인 성공 시 userName도 함께 반환
      return res.json({
        success: true,
        userName: name
      });
    } else {
      return res.json({
        success: false,
        message: "비밀번호가 일치하지 않습니다."
      });
    }

  } catch (err) {
    console.error("로그인 오류:", err);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.log("Connection close error:", err);
      }
    }
  }
});


// 아이디 찾기: POST /user/find-id
app.post("/user/find-id", async (req, res) => {
  const userName = (req.body?.userName || "").trim();
  const userTel  = (req.body?.userTel  || "").trim();

  if (!userName || !userTel) {
    return res.status(400).json({ success:false, message:"이름과 전화번호를 모두 입력해 주세요." });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT userId 
         FROM user_table 
        WHERE userName = :userName 
          AND userTel  = :userTel`,
      { userName, userTel },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "일치하는 회원정보가 없습니다. 회원가입을 하거나 다시 입력해 주세요."
      });
    }

    const userId = result.rows[0].USERID;
    return res.json({ success: true, userId });
  } catch (err) {
    console.error("find-id error:", err);
    return res.status(500).json({ success:false, message:"서버 오류", detail: err.message });
  } finally {
    if (connection) try { await connection.close(); } catch(e) { console.log(e); }
  }
});



// 비밀번호 찾기: POST /user/find-pw
app.post("/user/find-pw", async (req, res) => {
  const userId   = (req.body?.userId   || "").trim();
  const userName = (req.body?.userName || "").trim();

  if (!userId || !userName) {
    return res.status(400).json({ success:false, message:"아이디와 이름을 모두 입력해 주세요." });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT userPw 
         FROM user_table 
        WHERE userId   = :userId 
          AND userName = :userName`,
      { userId, userName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "일치하는 회원정보가 없습니다. 다시 입력해 주세요."
      });
    }

    // ⚠️ 실제 운영에서는 비밀번호를 그대로 반환하면 안 됩니다.
    //     임시 비밀번호 발급/재설정 링크 메일 전송 등을 권장합니다.
    const userPw = (result.rows[0].USERPW || "").trim();

    return res.json({ success: true, userPw });
  } catch (err) {
    console.error("find-pw error:", err);
    return res.status(500).json({ success:false, message:"서버 오류", detail: err.message });
  } finally {
    if (connection) try { await connection.close(); } catch(e) { console.log(e); }
  }
});

// 회원 프로필 조회
// GET /user/profile?userId=abc
app.get("/user/profile", async (req, res) => {
  const userId = (req.query?.userId || "").trim();
  if (!userId) {
    return res.status(400).json({ success:false, message:"userId가 필요합니다." });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    const result = await connection.execute(
      `SELECT userId, userName, userTel, userAddress
         FROM user_table
        WHERE userId = :userId`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.json({ success:false, message:"존재하지 않는 회원입니다." });
    }

    const row = result.rows[0];
    // 보안상 userPw는 반환하지 않음
    res.json({
      success: true,
      data: {
        userId: row.USERID,
        userName: row.USERNAME,
        userTel: row.USERTEL,
        userAddress: row.USERADDRESS
      }
    });
  } catch (err) {
    console.error("profile get error:", err);
    res.status(500).json({ success:false, message:"서버 오류", detail: err.message });
  } finally {
    if (connection) try { await connection.close(); } catch(e) {}
  }
});


// 회원 프로필 수정
app.put("/user/profile", async (req, res) => {
  const userId      = (req.body?.userId || "").trim();
  const userName    = (req.body?.userName || "").trim();
  const userTel     = (req.body?.userTel || "").trim();
  const userAddress = (req.body?.userAddress || "").trim();
  const userPw      = (req.body?.userPw || "").trim(); // 선택

  if (!userId || !userName || !userTel || !userAddress) {
    return res.status(400).json({ success:false, message:"userId, userName, userTel, userAddress는 필수입니다." });
  }

  // 전화번호 간단 검증 (프론트와 동일)
  const telRe = /^0\d{1,2}-\d{3,4}-\d{4}$/;
  if (!telRe.test(userTel)) {
    return res.status(400).json({ success:false, message:"전화번호 형식이 올바르지 않습니다. 예) 010-1234-5678" });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // userTel UNIQUE 제약 위배 체크 (본인 제외)
    const dupTel = await connection.execute(
      `SELECT COUNT(*) AS CNT
         FROM user_table
        WHERE userTel = :userTel
          AND userId <> :userId`,
      { userTel, userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (dupTel.rows[0].CNT > 0) {
      return res.json({ success:false, message:"이미 사용 중인 전화번호입니다." });
    }

    // 동적 업데이트: 비번이 있으면 비번도 수정
    let sql;
    let binds;
    if (userPw) {
      sql = `
        UPDATE user_table
           SET userPw = :userPw,
               userName = :userName,
               userTel = :userTel,
               userAddress = :userAddress
         WHERE userId = :userId
      `;
      binds = { userPw, userName, userTel, userAddress, userId };
    } else {
      sql = `
        UPDATE user_table
           SET userName = :userName,
               userTel = :userTel,
               userAddress = :userAddress
         WHERE userId = :userId
      `;
      binds = { userName, userTel, userAddress, userId };
    }

    const result = await connection.execute(sql, binds, { autoCommit: true });

    if (!result.rowsAffected) {
      return res.json({ success:false, message:"수정할 회원이 존재하지 않습니다." });
    }

    res.json({ success:true });
  } catch (err) {
    console.error("profile put error:", err);

    // UNIQUE 제약(전화번호 등) 위배시 ORA-00001
    if (String(err.message).includes("ORA-00001")) {
      return res.json({ success:false, message:"중복된 정보가 있습니다. (전화번호 등)" });
    }

    res.status(500).json({ success:false, message:"서버 오류", detail: err.message });
  } finally {
    if (connection) try { await connection.close(); } catch(e) {}
  }
});

// qna
app.get("/qna", async (req, res) => {
  let connection;
  try {
    // 🔹 풀 alias 사용
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // question_table에서 모든 질문 가져오기 (객체 형식)
    const questionsResult = await connection.execute(
      `SELECT qNo, qTitle, qContent, qWriter FROM question_table ORDER BY qNo`,
      [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    // answer_table에서 질문에 대한 댓글 가져오기
    const answersResult = await connection.execute(
      `SELECT aNo, aContent, aWriter FROM answer_table`,
      [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    // 질문과 답변 매핑
    const answersMap = {};
    answersResult.rows.forEach(row => {
      const {
        ANO,
        ACONTENT,
        AWRITER
      } = row;
      if (!answersMap[ANO]) answersMap[ANO] = [];
      answersMap[ANO].push({
        aContent: ACONTENT,
        aWriter: AWRITER
      });
    });

    const data = questionsResult.rows.map(row => {
      const {
        QNO,
        QTITLE,
        QCONTENT,
        QWRITER
      } = row;
      return {
        qNo: QNO,
        qTitle: QTITLE,
        qContent: QCONTENT,
        qWriter: QWRITER,
        answers: answersMap[QNO] || []
      };
    });

    res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error("QnA fetch error:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.log(err);
      }
    }
  }
});

// 질문 등록하기
app.post("/question", async (req, res) => {
  const {
    qTitle,
    qContent,
    qWriter
  } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `INSERT INTO question_table (qNo, qTitle, qContent, qWriter)
       VALUES (question_no_seq.NEXTVAL, :title, :content, :writer)`, {
        title: qTitle,
        content: qContent,
        writer: qWriter
      }, {
        autoCommit: true
      }
    );

    if (result.rowsAffected && result.rowsAffected > 0) {
      res.json({
        success: true
      });
    } else {
      res.json({
        success: false,
        message: "질문 등록에 실패했습니다."
      });
    }

  } catch (err) {
    console.error("질문 등록 오류:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Connection close error:", err);
      }
    }
  }
});

// Q&A 답변 등록
app.post("/answer", async (req, res) => {
  const {
    qNo,
    aContent,
    aWriter
  } = req.body;
  if (!qNo || !aContent || !aWriter) {
    return res.json({
      success: false,
      message: "필수 값이 누락되었습니다."
    });
  }

  try {
    const connection = await oracledb.getConnection(dbConfig.poolAlias);
    await connection.execute(
      `INSERT INTO answer_table (aNo, aContent, aWriter)
       VALUES (:qNo, :aContent, :aWriter)`, {
        qNo,
        aContent,
        aWriter
      }, {
        autoCommit: true
      }
    );
    res.json({
      success: true
    });
    await connection.close();
  } catch (err) {
    console.error("답변 등록 오류:", err);
    res.json({
      success: false,
      message: err.message
    });
  }
});

// 상품 등록
app.post("/products", upload.single("productImage"), async (req, res) => {
  let connection;

  try {
    const { prodName, prodDes, prodCate, prodCount, prodPrice, prodSeller } = req.body;
    const imgPath = req.file ? `js/project/img/${req.file.filename}` : null;

    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 1) 상품 기본 정보 저장 후 prodNo 가져오기
    const result = await connection.execute(
      `
      INSERT INTO product_table
      (prodNo, prodName, prodDes, prodCate, prodCount, prodPrice, prodSeller)
      VALUES (product_no_seq.NEXTVAL, :prodName, :prodDes, :prodCate, :prodCount, :prodPrice, :prodSeller)
      RETURNING prodNo INTO :prodNo
      `,
      {
        prodName,
        prodDes,
        prodCate,
        prodCount,
        prodPrice,
        prodSeller,
        prodNo: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: false } // 자동 커밋 X (두 번째 insert까지 하고 커밋)
    );

    const newProdNo = result.outBinds.prodNo[0];

    // 2) 이미지 테이블에 저장
    if (imgPath) {
      await connection.execute(
        `
        INSERT INTO product_image_table
        (imgNo, prodNo, imgPath)
        VALUES (product_img_seq.NEXTVAL, :prodNo, :imgPath)
        `,
        { prodNo: newProdNo, imgPath },
        { autoCommit: false }
      );
    }

    // 두 쿼리 모두 성공 시 커밋
    await connection.commit();

    res.json({ success: true, prodNo: newProdNo });
  } catch (err) {
    console.error("상품 등록 오류:", err);
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: "상품 등록 실패" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("DB 연결 종료 오류:", err);
      }
    }
  }
});


// 상품 검색
app.get("/products/search", async (req, res) => {
  const keyword = req.query.keyword;

  try {
    const connection = await oracledb.getConnection(dbConfig.poolAlias);
    const result = await connection.execute(
      `SELECT p.prodNo, p.prodName, p.prodCate, p.prodPrice, p.prodCount,
              NVL(i.imgPath, 'js/project/img/default.png') as imgPath
       FROM product_table p
       LEFT JOIN product_image_table i
       ON p.prodNo = i.prodNo
       WHERE p.prodName LIKE :keyword`,
      [`%${keyword}%`], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    await connection.close();

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("검색 오류:", err);
    res.json({
      success: false,
      message: "검색 실패",
      detail: err.message
    });
  }
});

// 상품 카테고리별 전체 가져오기
app.get("/products/category/:cateId", async (req, res) => {
  let connection;
  const cateId = req.params.cateId;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT p.prodNo, p.prodName, p.prodPrice, p.prodDes, p.prodCate,
              pi.imgPath
       FROM product_table p
       LEFT JOIN (
         SELECT prodNo, MIN(imgNo) AS imgNo, MIN(imgPath) AS imgPath
         FROM product_image_table
         GROUP BY prodNo
       ) pi ON p.prodNo = pi.prodNo
       WHERE p.prodCate = :cateId
       ORDER BY p.prodNo`,
      [cateId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("카테고리 상품 가져오기 오류:", err);
    res.status(500).json({
      success: false,
      message: "카테고리 상품 조회 오류",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close().catch(err => console.log("Connection close error:", err));
  }
});


// 카테고리 내 검색
app.get("/products/category/:cateId/search", async (req, res) => {
  let connection;
  const cateId = req.params.cateId;
  const keyword = req.query.keyword || "";
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT p.prodNo, p.prodName, p.prodPrice, p.prodDes, p.prodCate,
              pi.imgPath
       FROM product_table p
       LEFT JOIN (
         SELECT prodNo, MIN(imgNo) AS imgNo, MIN(imgPath) AS imgPath
         FROM product_image_table
         GROUP BY prodNo
       ) pi ON p.prodNo = pi.prodNo
       WHERE p.prodCate = :cateId
       AND p.prodName LIKE '%' || :keyword || '%'
       ORDER BY p.prodNo`,
      [cateId, keyword], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("카테고리 검색 오류:", err);
    res.status(500).json({
      success: false,
      message: "카테고리 검색 오류",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close().catch(err => console.log("Connection close error:", err));
  }
});


// 전체 상품 불러오기
app.get("/products/all", async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT p.prodNo, p.prodName, p.prodPrice, p.prodDes, p.prodCate, pi.imgPath
       FROM product_table p
       LEFT JOIN (
         SELECT prodNo, MIN(imgNo) AS imgNo, imgPath
         FROM product_image_table
         GROUP BY prodNo, imgPath
       ) pi ON p.prodNo = pi.prodNo
       ORDER BY p.prodNo`,
      [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("전체 상품 불러오기 오류:", err);
    res.status(500).json({
      success: false,
      message: "전체 상품 조회 오류",
      detail: err.message,
    });
  } finally {
    if (connection) await connection.close().catch(err => console.log("Connection close error:", err));
  }
});

// 상품 상세 조회
app.get("/products/:prodNo", async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    const prodNo = Number(req.params.prodNo);

    const result = await connection.execute(
      `SELECT 
  p.prodNo      AS prodNo,
  p.prodName    AS prodName,
  p.prodPrice   AS prodPrice,
  p.prodDes     AS prodDes,
  p.prodCate    AS prodCate,
  p.prodCount   AS prodCount,
  pi.imgPath    AS imgPath,
  p.prodSeller  AS prodSeller
FROM product_table p
LEFT JOIN (
  SELECT prodNo, MIN(imgNo) AS imgNo, MAX(imgPath) AS imgPath
  FROM product_image_table
  GROUP BY prodNo
) pi ON p.prodNo = pi.prodNo
WHERE p.prodNo = :prodNo
`,
      [prodNo], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "상품을 찾을 수 없습니다."
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("상품 상세 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "상품 조회 오류",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close().catch(err => console.log("Connection close error:", err));
  }
});

const fs = require("fs/promises");

// 상품 수정 (텍스트 + 이미지 교체)
app.put("/products/:prodNo", upload.single("productImage"), async (req, res) => {
  const prodNo = Number(req.params.prodNo);

  // multer가 파싱한 필드
  const prodName  = (req.body?.prodName  || "").trim();
  const prodDes   = (req.body?.prodDes   || "").trim();
  const prodCate  = Number(req.body?.prodCate);
  const prodCount = Number(req.body?.prodCount);
  const prodPrice = Number(req.body?.prodPrice);
  const requester = (req.body?.loggedInUser || "").trim(); // 소유자 검증 용

  // 새로 업로드된 파일(선택)
  const imgPath = req.file ? `js/project/img/${req.file.filename}` : null;

  if (!prodName || !prodDes || !prodCate || isNaN(prodCount) || isNaN(prodPrice)) {
    return res.status(400).json({ success:false, message:"필수 값이 누락되었습니다." });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 0) 소유자 검증(선택) — 프론트에서 보낸 로그인아이디와 DB 판매자 일치 확인
    if (requester) {
      const own = await connection.execute(
        `SELECT prodSeller FROM product_table WHERE prodNo = :prodNo`,
        { prodNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (own.rows.length === 0) {
        return res.status(404).json({ success:false, message:"상품이 존재하지 않습니다." });
      }
      const dbSeller = own.rows[0].PRODSELLER;
      if (dbSeller !== requester) {
        return res.status(403).json({ success:false, message:"수정 권한이 없습니다." });
      }
    }

    // 트랜잭션 시작
    await connection.execute("BEGIN NULL; END;");

    // 1) 기본 정보 업데이트
    const upd = await connection.execute(
      `
      UPDATE product_table
         SET prodName  = :prodName,
             prodDes   = :prodDes,
             prodCate  = :prodCate,
             prodCount = :prodCount,
             prodPrice = :prodPrice
       WHERE prodNo    = :prodNo
      `,
      { prodName, prodDes, prodCate, prodCount, prodPrice, prodNo }
    );

    if (!upd.rowsAffected) {
      await connection.rollback();
      return res.json({ success:false, message:"상품 수정 실패 (존재하지 않음)" });
    }

    // 2) 이미지 교체가 요청된 경우
    if (imgPath) {
      // 기존 이미지 목록을 미리 가져와서, DB 삭제 후 커밋 성공 시 파일도 삭제(선택)
      const oldImgs = await connection.execute(
        `SELECT imgPath FROM product_image_table WHERE prodNo = :prodNo`,
        { prodNo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const oldPaths = oldImgs.rows.map(r => r.IMGPATH);

      // 기존 이미지 레코드 삭제
      await connection.execute(
        `DELETE FROM product_image_table WHERE prodNo = :prodNo`,
        { prodNo }
      );

      // 새 이미지 1건 삽입 (단일 이미지 정책)
      await connection.execute(
        `
        INSERT INTO product_image_table (imgNo, prodNo, imgPath)
        VALUES (product_img_seq.NEXTVAL, :prodNo, :imgPath)
        `,
        { prodNo, imgPath }
      );

      // 모두 OK면 커밋
      await connection.commit();

      // (선택) 기존 파일 삭제 시도 — 커밋 이후에 실행
      for (const p of oldPaths) {
        try {
          // static 루트 기준 경로를 실제 디스크 경로로 변환
          const absolute = path.join(__dirname, "../../web-master/public", p);
          await fs.unlink(absolute);
        } catch (_) { /* 파일 없을 수 있음 - 무시 */ }
      }
    } else {
      // 이미지 변경 없음 → 기본정보만 변경 커밋
      await connection.commit();
    }

    return res.json({ success:true });
  } catch (err) {
    console.error("상품 수정 오류:", err);
    try { if (connection) await connection.rollback(); } catch {}
    return res.status(500).json({ success:false, message:"서버 오류", detail: err.message });
  } finally {
    if (connection) try { await connection.close(); } catch(e) {}
  }
});

// 상품 삭제: DELETE /products/:prodNo
// body: { seller: "로그인ID" }
app.delete("/products/:prodNo", async (req, res) => {
  const prodNo = Number(req.params.prodNo);
  const seller = req.body?.seller;

  if (!seller) {
    return res.status(400).json({ success: false, message: "요청자 정보(seller)가 필요합니다." });
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig.poolAlias);

    // 0) 판매자 권한 확인
    const sel = await conn.execute(
      `SELECT prodSeller FROM product_table WHERE prodNo = :prodNo`,
      { prodNo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (sel.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 상품이 존재하지 않습니다." });
    }
    if (sel.rows[0].PRODSELLER !== seller) {
      return res.status(403).json({ success: false, message: "삭제 권한이 없습니다. (판매자 불일치)" });
    }

    // 트랜잭션 시작 (명시적으로 autoCommit 끄고 진행)
    await conn.execute("BEGIN NULL; END;");

    // 1) 이미지(자식) 삭제
    await conn.execute(
      `DELETE FROM product_image_table WHERE prodNo = :prodNo`,
      { prodNo }
    );

    // 2) 주문(자식) 삭제  ← ★ 이 부분이 기존 코드에 없었음
    await conn.execute(
      `DELETE FROM order_table WHERE prodNo = :prodNo`,
      { prodNo }
    );

    // 필요시: 장바구니/리뷰 등 다른 자식 테이블도 여기서 먼저 삭제
    // await conn.execute(`DELETE FROM cart_table WHERE prodNo = :prodNo`, { prodNo });
    // await conn.execute(`DELETE FROM review_table WHERE prodNo = :prodNo`, { prodNo });

    // 3) 상품(부모) 삭제
    const del = await conn.execute(
      `DELETE FROM product_table WHERE prodNo = :prodNo`,
      { prodNo }
    );

    await conn.commit();

    if (!del.rowsAffected) {
      return res.status(500).json({ success: false, message: "상품 삭제에 실패했습니다." });
    }

    return res.json({
      success: true,
      data: { prodNo },
      message: "상품이 성공적으로 삭제되었습니다."
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("상품 삭제 오류:", err);
    return res.status(500).json({
      success: false,
      message: "상품 삭제 중 서버 오류가 발생했습니다.",
      detail: err.message
    });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { console.log("Connection close error:", e); } }
  }
});



// 주문 등록 + 재고 차감
app.post("/orders", async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const {
      prodNo,
      ordCount,
      ordBuyer,
      ordSeller
    } = req.body;

    // 트랜잭션 시작
    await connection.execute("BEGIN NULL; END;");

    // 1. 재고 확인
    const stockCheck = await connection.execute(
      `SELECT prodCount FROM product_table WHERE prodNo = :prodNo`, {
        prodNo
      }, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    if (stockCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "상품이 존재하지 않습니다."
      });
    }

    const currentStock = stockCheck.rows[0].PRODCOUNT;
    if (currentStock < ordCount) {
      return res.status(400).json({
        success: false,
        message: "재고가 부족합니다."
      });
    }

    // 2. 주문 등록
    await connection.execute(
      `
      INSERT INTO order_table (ordNo, prodNo, ordCount, ordBuyer, ordSeller)
      VALUES (order_seq.NEXTVAL, :prodNo, :ordCount, :ordBuyer, :ordSeller)
      `, {
        prodNo,
        ordCount,
        ordBuyer,
        ordSeller
      }
    );

    // 3. 재고 차감
    await connection.execute(
      `
      UPDATE product_table
      SET prodCount = prodCount - :ordCount
      WHERE prodNo = :prodNo
      `, {
        ordCount,
        prodNo
      }
    );

    await connection.commit();

    res.json({
      success: true,
      message: "구매 완료! 재고가 차감되었습니다."
    });
  } catch (err) {
    console.error("구매 처리 오류:", err);
    res.status(500).json({
      success: false,
      message: "구매 처리 중 오류 발생",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close().catch(err => console.log("Connection close error:", err));
  }
});

//주문 내역 조회
app.get("/orders", async (req, res) => {
  let connection;

  const buyerId = req.query.buyerId; // 프론트에서 넘긴 buyerId
  if (!buyerId) {
    return res.status(400).json({
      success: false,
      message: "구매자 ID가 필요합니다."
    });
  }

  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT 
          o.ordNo       AS "ORDNO",
          o.ordCount    AS "ORDCOUNT",
          o.ordBuyer    AS "ORDBUYER",
          o.ordSeller   AS "ORDSELLER",
          p.prodName    AS "PRODNAME",
          pi.imgPath    AS "IMGPATH"
        FROM order_table o
        JOIN product_table p ON o.prodNo = p.prodNo
        LEFT JOIN (
          SELECT prodNo, MIN(imgNo) AS imgNo, imgPath
          FROM product_image_table
          GROUP BY prodNo, imgPath
        ) pi ON p.prodNo = pi.prodNo
        WHERE o.ordBuyer = :buyerId
        ORDER BY o.ordNo DESC`,
      [buyerId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("주문 내역 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "주문 내역 조회 오류",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close().catch(e => console.log("Connection close error:", e));
  }
});


const port = 3000;

// 서버 시작 전에 initialize()를 완료하고, 성공 했을 때만 listen() 실행
async function startServer() {
  await initialize();
  app.listen(port,'0.0.0.0',() => {
    console.log(`Server is listening on http://localhost:${port}`);
  });
}

startServer();