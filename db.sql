create table counters (name varchar(80) primary key, count int);
# Default counter is 'default'
insert into counters (name, count) values ('default', 0);
