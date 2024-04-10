create table questions (
  id int primary key generated always as identity,
  ord int not null unique,
  description text
);
