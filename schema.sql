create table questions (
  id int primary key generated always as identity,
  ord int not null unique, 
  kind varchar(80) default 'radio',
  description text
);

create table options (
  question int references questions (id) on delete cascade,
  ord int not null,
  description text,
  selected bool not null default false,
  primary key (question, ord) deferrable initially deferred
);

create table users (
  name varchar(80) primary key,
  pass varchar(120) not null
);

create table sessions (
  id varchar(36) primary key,
  "user" varchar(80) references users (name)
);
