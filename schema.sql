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
  PRIMARY KEY (question, ord)
);
