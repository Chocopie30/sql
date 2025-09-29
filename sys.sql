select username from all_users;

alter session set "_ORACLE_SCRIPT"=true;

create user scott
identified by tiger
default tablespace users
temporary tablespace temp;

grant connect, resource, unlimited tablespace
to scott;

GRANT CREATE VIEW TO SCOTT;

SELECT *
FROM TAB;

SELECT *
FROM DBA_USERS
ORDER BY USERNAME;

SELECT *
FROM DBA_USERS
WHERE USERNAME = 'SCOTT';

ALTER USER SCOTT ACCOUNT UNLOCK;