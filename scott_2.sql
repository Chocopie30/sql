SELECT *
FROM tab; -- table 다 출력

SELECT sysdate, to_char(sysdate, 'rrrr/mm/dd') AS "system"
      ,to_char(12345.6, '$099,999.99') AS "NUM" 
      -- 원하는 방식으로 표현 가능, 9는 숫자를 뜻함, 
FROM dual;

SELECT empno
      ,ename
      ,job
      ,to_char(sal,'999,999') AS "salary"
FROM emp;

SELECT *
FROM professor
WHERE hiredate >= TO_DATE('1990/01/01 09:00:00', 'RRRR/MM/DD HH24:MI:SS')
AND hiredate < TO_DATE('2000/01/01 09:00:00','RRRR/MM/DD HH24:MI:SS');

SELECT *
FROM EMP
WHERE SAL + NVL(comm,0) >= 2000;

--NVL 함수 퀴즈
SELECT PROFNO 
      ,NAME
      ,PAY
      ,NVL(BONUS,0) AS "BONUS"
      ,PAY*12 +NVL(BONUS,0) AS "TOTAL" 
FROM PROFESSOR
WHERE DEPTNO=201;

SELECT PROFNO
      ,NAME
      ,NVL2(BONUS, (PAY*12)+BONUS, (PAY*12)) AS "TOTAL"
      --NVL2(보너스가, NULL이 아니면, NULL이면)
FROM PROFESSOR;

--NVL2 함수 퀴즈
SELECT EMPNO
      ,ENAME
      ,COMM
      ,NVL2(COMM,'EXIST','NULL') AS "NVL2"
FROM EMP
WHERE DEPTNO = 30;

SELECT EMPNO
      ,ENAME
      ,DECODE(JOB, 'SALESMAN', '영업부서','MANAGER','관리부서','기타부서') AS "DEPT"
      --조건문 DECODE(JOB의, 내용이, 만족하면, 아니면)
      ,JOB
FROM EMP;

--DECODE 퀴즈1
SELECT NAME
      ,JUMIN
      ,DECODE(SUBSTR(JUMIN,7,1),1,'MAN','WOMAN') AS "GENDER"
FROM STUDENT
WHERE DEPTNO1 = 101;

--DECODE 퀴즈2
SELECT NAME
      ,TEL
      ,DECODE(SUBSTR(TEL,1,INSTR(TEL,')')-1),02,'SEOUL'
                                            ,031,'GYEONGGI'
                                            ,051,'BUSAN'
                                            ,052,'ULSAN'
                                            ,055,'GYEONGNAM')AS "LOC"                                      
FROM STUDENT
WHERE DEPTNO1 = 101;

--CASE문
SELECT NAME
      ,TEL
      ,CASE SUBSTR(TEL,1,INSTR(TEL,')')-1) WHEN '02' THEN 'SEOUL'
                                           WHEN '031' THEN 'GYEONGGI'
                                           WHEN '051' THEN 'BUSAN'
                                           WHEN '052' THEN 'ULSAN'
                                           WHEN '055' THEN 'GYEONGNAM'
                                           ELSE '기타'
      END AS "LOC"
FROM STUDENT
WHERE DEPTNO1 = 101;

SELECT PROFNO
      ,NAME
      ,POSITION
      ,PAY*12 AS "PAY"
      ,CASE WHEN PAY*12 > 5000 THEN 'HIGH'
            WHEN PAY*12 > 4000 THEN 'MID'
            WHEN PAY*12 > 3000 THEN 'LOW'
            ELSE 'Etc'
      END AS "SAL"
FROM PROFESSOR
WHERE CASE WHEN PAY*12 > 5000 THEN 'HIGH'
            WHEN PAY*12 > 4000 THEN 'MID'
            WHEN PAY*12 > 3000 THEN 'LOW'
            ELSE 'Etc'
      END = 'HIGH';
      
--CASE문 퀴즈
SELECT EMPNO
      ,ENAME
      ,SAL
      ,CASE WHEN SAL >= 1 AND SAL <= 1000 THEN 'LEVEL 1'
            WHEN SAL >= 1001 AND SAL <= 2000 THEN 'LEVEL 2'
            WHEN SAL >= 2001 AND SAL <= 3000 THEN 'LEVEL 3'
            WHEN SAL >= 3001 AND SAL <= 4000 THEN 'LEVEL 4'
            ELSE 'LEVEL 5'
      END AS "LEVEL"
FROM EMP
ORDER BY 4 DESC; -- 4번째 열 역순정렬

SELECT *
FROM DEPARTMENT;

SELECT PROFNO
      ,NAME
      ,'PROFESSOR'
      ,PAY
FROM PROFESSOR
WHERE DEPTNO = 101
UNION -- 컬럼 갯수가 맞을때 두개의 결과 합칠 수 있다
SELECT STUDNO
      ,NAME
      ,'STUDENT'
      ,0
FROM STUDENT
WHERE DEPTNO1 = 101;

SELECT MAX(JOB)
      ,COUNT(*) AS "인원"
      ,SUM(SAL) AS "직무 급여 합계"
      ,TRUNC(AVG(SAL)) AS "급여 평균"
      ,TRUNC(STDDEV(SAL)) AS "표준편차"
      ,TRUNC(VARIANCE(SAL)) AS "분산"
FROM EMP
GROUP BY JOB;

SELECT TO_CHAR(HIREDATE, 'RRRR') AS "HD"
      ,COUNT(*) AS "인원"
FROM EMP
GROUP BY TO_CHAR(HIREDATE, 'RRRR');

--학생, 학과별 인원
SELECT DEPTNO1,COUNT(*) AS "인원"
FROM STUDENT
GROUP BY DEPTNO1
HAVING COUNT(*) > 2;

--교수, POSITION, PAY합계, 최고급여, 최저급여
SELECT POSITION
      ,SUM(PAY) AS "급여합계"
      ,MAX(PAY) AS "최고급여"
      ,MIN(PAY) AS "최저급여"
FROM PROFESSOR
GROUP BY POSITION;

--사원,부서별 평균급여, 인원 
SELECT DEPTNO AS "부서"
      ,NULL AS "직무" 
      --밑에 출력문과 합치기 위해 컬럼 맞추기
      ,TRUNC(AVG(SAL)) AS "평균급여" 
      ,COUNT(*) AS "인원"
      ,'A'
FROM EMP
GROUP BY DEPTNO
UNION
--사원,부서, 직무별 평균급여, 인원
SELECT DEPTNO
      ,JOB
      ,TRUNC(AVG(SAL)) AS "평균급여"
      ,COUNT(*) AS "인원"
      ,'B'
FROM EMP
GROUP BY DEPTNO, JOB
UNION
--사원, 평균급여, 인원
SELECT NULL
      ,NULL
      ,TRUNC(AVG(SAL)) AS "평균급여"
      ,COUNT(*) AS "인원"
      ,'C'
FROM EMP
ORDER BY 1,2;

--RILLUP함수
SELECT NVL(TO_CHAR(DEPTNO),'전체') AS "부서"
      ,NVL(JOB,'합계') AS "직무"
      ,ROUND(AVG(SAL)) AS "평균급여"
      ,COUNT(*) AS "사원수"
FROM EMP
GROUP BY CUBE(DEPTNO,JOB)
ORDER BY 1,2;

SELECT COUNT(*) FROM EMP; -- 12
SELECT COUNT(*) FROM DEPT; -- 4

SELECT COUNT(*) -- DEPT * EMP = 48
FROM EMP,DEPT;

SELECT *
FROM EMP
JOIN DEPT
ON EMP.DEPTNO = DEPT.DEPTNO;

SELECT *
FROM STUDENT; --PROFNO

SELECT *
FROM PROFESSOR;

--ANSI JOIN
SELECT STUDNO
      ,S.NAME AS "학생 이름"
      ,GRADE
      ,P.NAME AS "교수 이름"
      ,S.DEPTNO1
      ,D.DNAME AS "학과명"
FROM STUDENT S -- 별칭으로 붙일 수 있다
LEFT OUTER JOIN PROFESSOR P -- FROM에 있는 내용을 토대로 합쳐 결과 출력
ON S.PROFNO = P.PROFNO
JOIN DEPARTMENT D
ON S.DEPTNO1 = D.DEPTNO;

SELECT P.PROFNO
      ,P.NAME
      ,S.STUDNO
      ,S.NAME
      ,S.PROFNO AS "담당교수"
FROM PROFESSOR P
RIGHT OUTER JOIN STUDENT S -- JOIN에 있는 내용을 토대로 합쳐 결과 출력
ON P.PROFNO = S.PROFNO;

SELECT *
FROM SALGRADE;

SELECT S.GRADE, E.*
FROM EMP E
JOIN SALGRADE S
ON E.SAL >= S.LOSAL
AND E.SAL <= S.HISAL
WHERE S.GRADE =2;

--ORACLE JOIN
SELECT E.*
FROM EMP E, DEPT D
WHERE E.DEPTNO = D.DEPTNO;

SELECT E1.EMPNO AS "사원번호"
      ,E1.ENAME AS "사원명"
      ,E2.EMPNO AS "관리자번호"
      ,E2.ENAME AS "관리자명"
FROM EMP E1, EMP E2
WHERE E1;

-- 254PAGE 1번
SELECT S.NAME AS "STU_NAME"
      ,DEPTNO1
      ,D.DNAME AS "DEPT_NAME"
FROM STUDENT S
JOIN DEPARTMENT D
ON S.DEPTNO1 = D.DEPTNO;

SELECT S.NAME AS "STU_NAME"
      ,DEPTNO1
      ,D.DNAME AS "DEPT_NAME"
FROM STUDENT S, DEPARTMENT D
WHERE S.DEPTNO1 = D.DEPTNO;

-- 2번
SELECT E.NAME "NAME"
      ,E.POSITION "POSITION"
      ,E.PAY "PAY"
      ,P.S_PAY "LOW PAY"
      ,P.E_PAY "HIGH PAY"
FROM EMP2 E
JOIN P_GRADE P
ON E.POSITION = P.POSITION;

-- 3번
SELECT *
FROM EMP2;

SELECT *
FROM P_GRADE;

SELECT E.NAME
      ,'2013'-SUBSTR(TO_CHAR(E.BIRTHDAY),1,4)"AGE"
      ,E.POSITION "CURR_POSITION"
      ,P.POSITION "BE_POSITION"
FROM EMP2 E
LEFT OUTER JOIN P_GRADE P
ON '2013'-SUBSTR(TO_CHAR(E.BIRTHDAY),1,4) BETWEEN P.S_AGE AND P.E_AGE
ORDER BY 2;

-- 4번
SELECT *
FROM CUSTOMER;

SELECT *
FROM GIFT;

SELECT C.GNAME "CUST_NAME"
      ,POINT
      ,G.GNAME "GIFT_NAME"
FROM CUSTOMER C
JOIN GIFT G
ON POINT BETWEEN G_START AND G_END
WHERE POINT >= 600001;

-- 5번
