select *
from tab;

select *
from employees;

select *
from departments;

select e.first_name, l.*
from employees e
join departments d
on e.department_id = d.department_id
join locations l
on d.location_id = l.location_id
where e.first_name = 'Donald';

select *
from locations;

select *
from jobs;

-- 프로그래머 사람들이 어떤 도시에 있는가
select e.first_name,j.job_id, l.city, l.street_address
from employees e
join departments d
on e.department_id = d.department_id
join locations l
on d.location_id = l.location_id
join jobs j
on j.job_id = e.job_id
where j.job_title = 'Programmer';

-- IT 부서의 매니저의 정보
select e.*
from employees e
join departments d
on d.manager_id = e.employee_id
where d.department_name = 'IT';

-- 본인 직업의 급여 최소 최대값을 벗어난 사람
select e.first_name,j.job_title, e.salary, j.min_salary, j.max_salary
from employees e
join jobs j
on e.job_id = j.job_id
where j.min_salary >= e.salary
or j.max_salary <= e.salary;

-- 서브쿼리 테스트를 위해 103번 salary 올리기
update employees
set salary = 20000
where employee_id = 103;

--서브쿼리를 사용해서 
select /*+ INDEX(e EMP_EMO_ID_PK) */ e.*
from employees e
where not exists (select 1
             from jobs j
             where e.job_id = j.job_id
             and e.salary between j.min_salary and j.max_salary);
             
-- 쇼핑몰 만든다 생각하고 테이블 구성해보기

drop table product_table purge;

alter table product_table modify odrSeller varchar2(20);
alter table product_table RENAME COLUMN prodManager TO prodSeller;
alter table product_table ADD prodCate number(1) default 1 CONSTRAINT prod_cate check(prodCate<4);
alter table product_table add prodDes varchar2(500);


-- 회원 테이블 / 아이디, 비번, 이름, 전화번호, 주소, 일반회원 1 관리자 2
create table user_table (
userId varchar2(20) CONSTRAINT user_id_pk primary key,
userPw varchar2(30) CONSTRAINT user_pw_nn not null,
userName varchar2(15) CONSTRAINT user_name_nn not null,
userTel varchar2(20) CONSTRAINT user_tel_uk unique,
userAddress VARCHAR2(50) CONSTRAINT user_address_nn not null,
userLevel number(1) default 1 CONSTRAINT user_level check(userLevel<3)
);

-- 관리자 계정 미리 넣어두기
insert into user_table
values ('admin','admin','관리자','010-0000-0000','지구 어딘가',2);

select *
from user_table;

commit;

-- 유저삭제
delete from user_table
where userid = 'user3';

-- 상품 테이블 / 상품번호, 이름, 갯수, 가격, 판매자
create table product_table (
prodNo number(3) CONSTRAINT prod_no_pk primary key,
prodName varchar2(20) CONSTRAINT prod_name_nn not null,
prodCount number(5) CONSTRAINT prod_count_nn not null,
prodPrice number(8) CONSTRAINT prod_price_nn not null,
prodManager varchar2(20) CONSTRAINT prod_manager references user_table(userId),
prodCate number(1) default 1 CONSTRAINT prod_cate check(prodCate<4)
);
-- prodManager -> prodSeller로 수정됨
-- prodcate 컬럼 추가 1:잡동사니 2:전자제품 3:음식으로 분류
-- prodDes 상품 설명 컬럼 추가

delete from product_table
where prodno = 24;

-- 상품 설명 정보 추가 입력
update product_table
set prodDes = '비밀 일기를 적어보세요! (ps.보안이 유지된다 하진 않았어요)'
where prodNo= 18;

-- 예시 상품 넣어두기
insert into product_table
values (product_no_seq.NEXTVAL, '다이어리', 600, 3000, 'admin',1);

-- 순서를 위해 시퀀스 사용
create SEQUENCE product_no_seq;

select *
from product_table;

commit;

--상품 이미지 경로 테이블
create table product_image_table (
imgNo number primary key,
prodNo NUMBER REFERENCES product_table(prodNo),
imgPath VARCHAR2(255) NOT NULL
);

-- 예시 상품 이미지 경로 연결하기
INSERT INTO product_image_table
VALUES (18, 18, '/js/project/img/choco.jpg');

--짜증나네요 영어로 업데이트 합니다 하하
update product_image_table
set imgPath = 'js/project/img/nolineKeyboard.jpg.jpg'
where imgNo = 8;

delete from product_image_table
where imgno = 21;

select *
from product_image_table;

create SEQUENCE product_img_seq;

select product_img_seq.nextval
from dual;

commit;

-- 상품 구매내역 테이블 / 상품번호, 구매 갯수, 구매자, 판매자
CREATE TABLE order_table (
  ordNo     NUMBER(5) PRIMARY KEY, -- 주문 번호 (고유 ID)
  prodNo    NUMBER(3) REFERENCES product_table(prodNo), -- 어떤 상품을 주문했는지
  ordCount  NUMBER(5) NOT NULL, -- 구매 수량
  ordBuyer  VARCHAR2(20) REFERENCES user_table(userId), -- 구매자 ID
  ordSeller VARCHAR2(20) REFERENCES user_table(userId)  -- 판매자 ID
);

--주문번호를 위한 시퀀스
CREATE SEQUENCE order_seq;

select *
from order_table;

-- Q&A 질문 테이블 / Q&A번호, 제목, 내용, 작성자
create table question_table (
qNo number(3) CONSTRAINT q_no_pk primary key,
qTitle varchar2(20) CONSTRAINT q_title_nn not null,
qContent varchar2(500) CONSTRAINT q_content_nn not null,
qWriter varchar2(20) CONSTRAINT q_writer references user_table(userId)
);
--제목 크기 수정
alter table question_table modify qTitle varchar2(50);

commit;
-- 순서를 위해 시퀀스 사용..
create SEQUENCE question_no_seq;

-- 예시 질문 넣기
INSERT into question_table
values (question_no_seq.nextval, '2번 질문 제목', '예시를 위해 2번 질문 내용을 표시합니다', 'admin');

select *
from question_table;

-- Q&A 답변 테이블 / Q&A번호, 답변내용, 작성자
create table answer_table (
aNo number(3) CONSTRAINT a_no_pk references question_table(qno),
aContent varchar2(500) CONSTRAINT a_content_nn not null,
aWriter varchar2(20) CONSTRAINT a_writer references user_table(userId)
);

-- 예시 답변 넣기
INSERT into answer_table
values (1, '1번 질문에 대한 답변 예시를 넣습니다', 'admin');

-- 시퀀스 만들었어용 
create SEQUENCE answer_no_seq;

select *
from answer_table;

--예시 답변 때문에 1올리기!
select answer_no_seq.nextval
from dual;

commit;
-------------

select *
from locations;

--1번
SELECT employee_id, last_name, salary, department_id
from employees
where salary between 7000 and 12000
and last_name like 'H%';

--2번
create or replace view emp_v
as
select *
from employees
where department_id =50
or department_id=60;

select employee_id, first_name, last_name, job_id, salary, department_id
from emp_v
where salary > 5000;

--3번
select first_name, last_name, salary,
case when salary <= 5000 then salary + (salary*0.2)
     when salary <= 10000 then salary + (salary*0.15)
     when salary <= 15000 then salary + (salary*0.1)
     else null
end "up_salary"
from employees
where :employee_id = employee_id;

--4번
select d.department_id, d.department_name, l.city
from departments d
join locations l
on d.location_id = l.location_id;

--5번
select e.employee_id, e.last_name, e.job_id
from employees e
where e.department_id in (select d.department_id
       from departments d
       where d.department_name ='IT');
       
--6번
select *
from employees
where job_id = 'ST_CLERK'
and hire_date < to_date('2004/01/01','rrrr/mm/dd');

--7번
select last_name, job_id, salary, commission_pct
from employees
where commission_pct is not null
order by 3 desc;

--8번
create table prof (
profno number(4),
name varchar2(15) not null,
id varchar2(15) not null,
hiredate date,
pay number(4)
);

--9번
--(1)
insert into prof (profno, name, id, hiredate, pay)
values (1001, 'Mark', 'm1001', '2007/03/01', 800);

insert into prof (profno, name, id, hiredate)
values (1003, 'Adam', 'a1003', '2011/03/02');

select *
from prof;

commit;

--(2)
update prof
set pay = 1200
where profno = 1001;

--(3)
delete from prof
where profno = 1003;

--10번
--(1)
alter table prof modify profno primary key;

--(2)
ALTER TABLE prof ADD gender char(3);

--(3)
ALTER TABLE prof MODIFY name VARCHAR2(20);