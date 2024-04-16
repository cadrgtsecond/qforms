create table questions (
  ord int primary key,
  kind varchar(80) default 'radio',
  description text
);

create table options (
  question int references questions (ord) on delete cascade,
  ord int not null,
  description text,
  PRIMARY KEY (question, ord)
);
