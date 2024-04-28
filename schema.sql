create table questions (
  id int primary key generated always as identity,
  ord int not null, 
  kind varchar(80) default 'radio',
  description text,
  unique (ord) deferrable initially deferred
);

create table options (
  question int references questions (id) on delete cascade,
  ord int not null,
  description text,
  primary key (question, ord) deferrable initially deferred
);
