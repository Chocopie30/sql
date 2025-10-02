select username from all_users order by username;

alter session set "_ORACLE_SCRIPT"=true;

--user만들기
create user hr
identified by hr
default tablespace users
temporary tablespace temp;

-- 권한주기
grant connect, resource, unlimited tablespace
to hr;

-- 뷰만들기 권한 주기
GRANT CREATE VIEW TO hr;

SELECT *
FROM TAB;

SELECT *
FROM DBA_USERS
ORDER BY USERNAME;

SELECT *
FROM DBA_USERS
WHERE USERNAME = 'SCOTT';

ALTER USER SCOTT ACCOUNT UNLOCK;