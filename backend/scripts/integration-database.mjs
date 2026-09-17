// CI-only bootstrap. Never invokes CREATE DATABASE against a non-test database.
import sql from 'mssql';
const database=process.env.DB_NAME,user=process.env.DB_USER,password=process.env.DB_PASSWORD;
if(!database?.endsWith('Test')||!/^[A-Za-z0-9_]+$/.test(database)||!/^cda_ci_\w+$/.test(user||'')||!password)throw Error('Only disposable CI databases are supported');
let pool;for(let n=0;n<60;n++){try{pool=await new sql.ConnectionPool({server:process.env.DB_SERVER,port:Number(process.env.DB_PORT||1433),database:'master',user:process.env.DB_ADMIN_USER,password:process.env.DB_ADMIN_PASSWORD,options:{encrypt:true,trustServerCertificate:true}}).connect();break}catch{await new Promise(r=>setTimeout(r,2000))}}
if(!pool)throw Error('SQL Server did not become ready');
try{await pool.request().batch(`IF DB_ID('${database}') IS NULL CREATE DATABASE [${database}];`);await pool.request().batch(`IF NOT EXISTS(SELECT 1 FROM sys.server_principals WHERE name='${user}') CREATE LOGIN [${user}] WITH PASSWORD=N'${password.replaceAll("'","''")}'; USE [${database}]; IF USER_ID('${user}') IS NULL CREATE USER [${user}] FOR LOGIN [${user}]; GRANT SELECT,INSERT,UPDATE,DELETE,EXECUTE ON SCHEMA::dbo TO [${user}]; DENY ALTER ON SCHEMA::dbo TO [${user}];`)}finally{await pool.close()}
