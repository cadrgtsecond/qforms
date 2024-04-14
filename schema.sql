create table questions (
  ord int primary key,
  kind varchar(80) default 'radio',
  description text
);

create table options (
  question int references questions,
  ord int not null,
  PRIMARY KEY (question, ord)
);
