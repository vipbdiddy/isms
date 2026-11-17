#!/usr/bin/env bash
# The words check: quotes, stories, loved ones and comments with words that might hurt someone wait for a
# reviewer, a reviewer's decision sticks, and three reports hide something until a reviewer looks.
# Run by run.sh.
cd "$(dirname "$0")" && . ./helpers.sh
A=aaaaaaaa-0000-0000-0000-000000000001   # Ann: adds the loved ones
B=bbbbbbbb-0000-0000-0000-000000000002   # Bob, Cat and Dan: strangers who read and report
C=cccccccc-0000-0000-0000-000000000003
D=dddddddd-0000-0000-0000-000000000004
E=eeeeeeee-0000-0000-0000-000000000005   # Eve: a reviewer
status() { $PSQL -c "select review_status from public.$1 where id = '$2'"; }

$PSQL > /dev/null <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$A', 'ann@example.com', '{"full_name": "Ann Lee"}'),
  ('$B', 'bob@example.com', '{"full_name": "Bob Stone"}'),
  ('$C', 'cat@example.com', '{"full_name": "Cat Moss"}'),
  ('$D', 'dan@example.com', '{"full_name": "Dan Hill"}'),
  ('$E', 'eve@example.com', '{"full_name": "Eve Reviewer"}');
insert into public.admins (user_id) values ('$E');
SQL

echo "-- loved ones"
UNCLE=$(as $A "insert into public.loved_ones (name, visibility, about) values ('Ann Uncle', 'public', 'He was a liar.') returning id")
check "hurtful words wait" "pending|0" "$(status loved_ones $UNCLE)|$(as $B "select count(*) from public.loved_ones where id = '$UNCLE'")"
as $A "update public.loved_ones set about = 'He fixed every bike on the street.' where id = '$UNCLE'" > /dev/null
check "kind words show" "ok|1" "$(status loved_ones $UNCLE)|$(as $B "select count(*) from public.loved_ones where id = '$UNCLE'")"
as $A "update public.loved_ones set relationship = 'Uncle' where id = '$UNCLE'" > /dev/null
check "changing something that isn't checked leaves it be" "ok" "$(status loved_ones $UNCLE)"

echo "-- quotes and stories"
Q=$(as $A "insert into public.isms (loved_one_id, text) values ('$UNCLE', 'She lied to us.') returning id")
check "hurtful words wait" "pending|0" "$(status isms $Q)|$(as $B "select count(*) from public.isms where id = '$Q'")"
as $E "select public.review_content('ism', '$Q', true)" > /dev/null
check "a reviewer can allow them" "approved|1" "$(status isms $Q)|$(as $B "select count(*) from public.isms where id = '$Q'")"
as $A "update public.isms set topics = '{family}' where id = '$Q'" > /dev/null
check "changing something that isn't checked keeps the decision" "approved" "$(status isms $Q)"
as $A "update public.isms set text = 'He was a liar.' where id = '$Q'" > /dev/null
check "new hurtful words wait again" "pending" "$(status isms $Q)"
as $E "select public.review_content('ism', '$Q', false)" > /dev/null
as $A "update public.isms set text = 'Kind words now.' where id = '$Q'" > /dev/null
check "something a reviewer removed stays removed, even when it's edited" "removed|0" "$(status isms $Q)|$(as $B "select count(*) from public.isms where id = '$Q'")"
K=$(as $A "insert into public.isms (loved_one_id, text) values ('$UNCLE', 'Always be kind.') returning id")
check "kind words show straight away" "ok|1" "$(status isms $K)|$(as anon "select count(*) from public.isms where id = '$K'")"

echo "-- comments"
COMMENT=$(as $B "insert into public.comments (ism_id, body) values ('$K', 'You liar.') returning id")
check "hurtful words wait" "pending" "$(status comments $COMMENT)"
KIND=$(as $B "insert into public.comments (ism_id, body) values ('$K', 'Lovely.') returning id")
check "kind words show" "ok" "$(status comments $KIND)"

echo "-- reports"
for who in $B $C; do as $who "select public.report_content('$K', null, 'Not true')" > /dev/null; done
check "two reports hide it from those who reported it, not from others" "0|1|ok" "$(as $B "select count(*) from public.isms where id = '$K'")|$(as anon "select count(*) from public.isms where id = '$K'")|$(status isms $K)"
as $D "select public.report_content('$K', null, 'Not true')" > /dev/null
check "a third hides it from everyone until a reviewer looks" "pending|0" "$(status isms $K)|$(as anon "select count(*) from public.isms where id = '$K'")"
as $E "select public.review_content('ism', '$K', true)" > /dev/null
check "allowed, it shows again (not to those who reported it)" "approved|1|0" "$(status isms $K)|$(as anon "select count(*) from public.isms where id = '$K'")|$(as $B "select count(*) from public.isms where id = '$K'")"

finish
