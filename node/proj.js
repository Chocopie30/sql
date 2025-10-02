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

//로그인
app.post('/login', async (req, res) => {
  const {
    userId,
    userPw
  } = req.body;
  let connection;

  try {
    // 🔹 단일 커넥션 방식
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 🔹 아이디로 DB 조회
    const result = await connection.execute(
      `SELECT userPw FROM user_table WHERE userId = :id`,
      [userId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      } // 객체 형식 반환
    );

    if (result.rows.length === 0) {
      // 아이디 없음
      return res.json({
        success: false,
        message: "존재하지 않는 아이디입니다."
      });
    }

    // 🔹 DB에서 가져온 비밀번호 (공백 제거)
    const dbPw = result.rows[0].USERPW.trim(); // 객체 형식이므로 키 이름 확인

    if (dbPw === userPw) {
      return res.json({
        success: true
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
    const connection = await oracledb.getConnection(dbConfig);
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

    connection = await oracledb.getConnection(dbConfig);

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
    const connection = await oracledb.getConnection(dbConfig);
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

// 상품 수정
app.put("/products/:prodNo", async (req, res) => {
  const {
    prodNo
  } = req.params;
  const {
    prodName,
    prodDes,
    prodCate,
    prodCount,
    prodPrice
  } = req.body;

  try {
    const connection = await oracledb.getConnection(dbConfig);

    const sql = `
      UPDATE product_table
      SET prodName = :prodName,
          prodDes = :prodDes,
          prodCate = :prodCate,
          prodCount = :prodCount,
          prodPrice = :prodPrice
      WHERE prodNo = :prodNo
    `;

    const result = await connection.execute(sql, {
      prodName,
      prodDes,
      prodCate,
      prodCount,
      prodPrice,
      prodNo
    }, {
      autoCommit: true
    });

    await connection.close();

    if (result.rowsAffected > 0) {
      res.json({
        success: true
      });
    } else {
      res.json({
        success: false,
        message: "상품 수정 실패 (존재하지 않음)"
      });
    }
  } catch (err) {
    console.error("상품 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류"
    });
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

// ----------------- 주문 내역 조회 -----------------
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
  app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
  });
}

startServer();