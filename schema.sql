create type question_type as enum ('text', 'checkbox', 'radio');
create table questions (
  id int primary key generated always as identity,
  ord int not null unique,
  description text
);

comment on table options is 'Only for checkbox and radio options';
create table options (
  question int references questions,
  ord int not null unique,
  primary key (question, ord)
);
