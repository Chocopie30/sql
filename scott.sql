-- 연습문제 1
SELECT * FROM student;

SELECT name || '''s ID: ' || id || ' , WEIGHT is ' || weight || 'kg' as "ID AND WEIGHT"
FROM student;


-- 연습문제 2
SELECT * FROM emp;

SELECT ename|| '('|| job || '), ' || ename ||'''' || job || '''' as "NAME AND JOB"
FROM emp;

-- 연습문제 3
SELECT ename || '''s sal is $' || sal as "Name And Sal"
FROM emp;

-- 조건절
SELECT empno
      ,ename
      ,job
      ,mgr
      ,hiredate
      ,sal + comm AS "Salary"
    --  ,comm
      ,deptno
FROM emp
WHERE empno >= 7900 AND empno < 8000
AND hiredate > '82/01/01';
-- hiredate > '80/12/31' AND hiredate < '82/01/01' ;

SELECT *
FROM professor
WHERE pay + nvl(bonus, 0) > 300;
-- email like '%naver.com';

SELECT profno
      ,lower(name) AS "low_name"
      ,upper(id) AS "upp_id"
      ,initcap(position) AS "pos" --첫글자 대문자 변환
      ,pay
      ,concat(concat(name,'-'),id) AS" name_id" -- 두 문자열 합치기
FROM professor
WHERE length(name) <> 10;

SELECT name
      ,length(name) AS "length" --문자열 길이값 출력
      ,lengthb('호이도잉') AS "lengthb" --문자열 바이트 값 출력
      ,substr(name, 1, 5) AS "substr" -- 지정한 길이만큼 출력 1에서 5까지
      ,instr(name,'a') AS "instr" -- 특정 문자 자리 순서 출력
      ,pay
      ,bonus
      ,lpad(id, 10, '*') AS "lpad" -- id가 10보다 작으면 남은 자리 지정 문자로 채우기
FROM professor
WHERE instr(upper(name), 'A') > 0;

SELECT *
FROM student;

SELECT name
      ,tel
      ,substr(tel,1,instr(tel,')')-1) AS "AREA CODE"
      ,instr(tel,')')
FROM student;

--replace 1
SELECT ename
      ,replace(ename,substr(ename,2,2),'--') AS "REPLACE"
FROM emp
WHERE deptno = 20;

--replace 2
SELECT name
      ,jumin
      ,rpad(substr(jumin,1,6),13,'-/') AS "REPLACE"
FROM student
WHERE deptno1 = 101;

--replace 3
SELECT name
      ,tel
      ,replace(tel,substr(tel,instr(tel,')')+1,
      instr(tel,'-')-instr(tel,')')-1),'***') AS "REPLACE"
      -- substr tel에서 )뒷자리부터 -앞자리까지 '***'로 변환
FROM student
WHERE deptno1 = 102;

--replace 4
SELECT name
      ,tel
     ,replace(tel,substr(tel,instr(tel,'-')+1,4),'****') AS "REPLACE"
FROM student
WHERE deptno1 = 101;

SELECT empno
      ,ename
      ,job
      ,round(sal / 12,2) AS "month" --반올림
      ,trunc(sal / 12) AS "trunc" --반내림
      ,mod(sal , 12) AS "mod"--나머지
      ,ceil(sal / 12) AS "ceil" --가까운 큰 정수
      ,floor(sal / 12) AS "floor" --가까운 작은 정수
      ,power(4,3) AS "pow" -- 승수
FROM emp;

SELECT months_between('16/01/01','12/01/01') 
--sysdate
FROM dual;

SELECT add_months(sysdate,2), next_day(sysdate, '목') AS "NEXT DAY"
      ,last_day(add_months(sysdate,1)) AS "last"
FROM dual;

SELECT sysdate,to_char(sysdate,'rrrr-mm-dd') AS "today" --날짜를 문자열로 변환
FROM dual
WHERE 1=1;

SELECT to_date('2025-05-05 13','rrrr-mm-dd hh24') AS "date" --문자열을 날짜로 변환
FROM dual;