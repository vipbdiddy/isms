#!/usr/bin/env bash
# A loved one can only use a photo its own owner uploaded, and only ever opens one from that owner's
# folder. Otherwise someone could point a loved one of theirs at another person's photo, and so see it
# or show it to others. Run by run.sh.
cd "$(dirname "$0")" && . ./helpers.sh
A=aaaaaaaa-0000-0000-0000-000000000001   # Ann: adds the loved ones
B=bbbbbbbb-0000-0000-0000-000000000002   # Bob: Ann's friend
C=cccccccc-0000-0000-0000-000000000003   # Cat: a stranger
M=dddddddd-0000-0000-0000-000000000004   # Mallory: a stranger who knows the path of one of Ann's photos
opens() { as "$1" "select count(*) from storage.objects where bucket_id = 'photos' and name = '$2'"; }
upload() { as "$1" "insert into storage.objects (bucket_id, name) values ('photos', '$2')" | has 'ERROR'; }
add() { # add <user> <name> <visibility> <photo path>: the new loved one's id, or the error
  as "$1" "insert into public.loved_ones (name, visibility, photo_path) values ('$2', '$3', '$4') returning id"
}
photo_of() { $PSQL -c "select coalesce(photo_path, '(none)') from public.loved_ones where id = '$1'"; }
rule_in_place() { $PSQL -c "select count(*) from pg_constraint where conname = 'loved_ones_photo_is_owners' and convalidated"; }

$PSQL > /dev/null <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$A', 'ann@example.com', '{"full_name": "Ann Lee"}'),
  ('$B', 'bob@example.com', '{"full_name": "Bob Stone"}'),
  ('$C', 'cat@example.com', '{"full_name": "Cat Moss"}'),
  ('$M', 'mal@example.com', '{"full_name": "Mal Lory"}');
insert into public.friendships (requester, addressee, status) values ('$A', '$B', 'accepted');
SQL

echo "-- photos reach the people they're shared with"
check "Ann uploads photos into her own folder" "" "$(upload $A $A/aunt.jpg)$(upload $A $A/secret.jpg)$(upload $A $A/public.jpg)$(upload $A $A/grandma.jpg)$(upload $A $A/new.jpg)"
check "nobody can upload into someone else's folder" "ERROR" "$(upload $M $A/planted.jpg)"
check "Mallory uploads into her own" "" "$(upload $M $M/own.jpg)"
AUNT=$(add $A 'Ann Aunt' friends $A/aunt.jpg)
SECRET=$(add $A 'Ann Secret' private $A/secret.jpg)
PUBLIC=$(add $A 'Ann Public' public $A/public.jpg)
GRANDMA=$(add $A 'Ann Grandma' private $A/grandma.jpg)
as $A "insert into public.isms (loved_one_id, text, visibility) values ('$GRANDMA', 'Shared with everyone.', 'public')" > /dev/null
check "a friend sees a friends-only photo" "1" "$(opens $B $A/aunt.jpg)"
check "a stranger doesn't, signed in or out" "0|0" "$(opens $C $A/aunt.jpg)|$(opens anon $A/aunt.jpg)"
check "everyone sees a public loved one's photo" "1|1" "$(opens $C $A/public.jpg)|$(opens anon $A/public.jpg)"
check "a quote shared with everyone shows whose it is, photo and all" "1|1" "$(opens $C $A/grandma.jpg)|$(opens anon $A/grandma.jpg)"
check "nobody but Ann sees the photo of a loved one only she can see" "1|0|0|0" "$(opens $A $A/secret.jpg)|$(opens $B $A/secret.jpg)|$(opens $M $A/secret.jpg)|$(opens anon $A/secret.jpg)"

echo "-- a loved one can't use someone else's photo"
check "adding one with someone else's photo is refused" "loved_ones_photo_is_owners" "$(add $M 'Mal Borrowed' public $A/secret.jpg | has 'loved_ones_photo_is_owners')"
MALS=$(add $M 'Mal Own' public $M/own.jpg)
check "her own photo is fine, and reaches everyone" "1" "$(opens anon $M/own.jpg)"
check "switching to someone else's photo is refused" "loved_ones_photo_is_owners" "$(as $M "update public.loved_ones set photo_path = '$A/secret.jpg' where id = '$MALS'" | has 'loved_ones_photo_is_owners')"
check "a look-alike folder doesn't pass" "loved_ones_photo_is_owners" "$(as $M "update public.loved_ones set photo_path = '${M}x/own.jpg' where id = '$MALS'" | has 'loved_ones_photo_is_owners')"
check "taking a photo off is fine" "(none)" "$(as $M "update public.loved_ones set photo_path = null where id = '$MALS'" > /dev/null; photo_of $MALS)"
check "Ann can change her aunt's photo to another of hers" "" "$(as $A "update public.loved_ones set photo_path = '$A/new.jpg' where id = '$AUNT'" | has 'ERROR')"
check "her friend sees the new one, not the old" "1|0" "$(opens $B $A/new.jpg)|$(opens $B $A/aunt.jpg)"
check "editing a loved one without touching the photo still works" "" "$(as $A "update public.loved_ones set about = 'She ran the bakery.' where id = '$SECRET'" | has 'ERROR')"

echo "-- and if a borrowed path got in some other way, it opens nothing"
$PSQL -c "alter table public.loved_ones drop constraint loved_ones_photo_is_owners" > /dev/null
$PSQL -c "update public.loved_ones set photo_path = '$A/secret.jpg' where id = '$MALS'" > /dev/null
check "(a borrowed path is in the table, on a loved one everyone can see)" "$A/secret.jpg" "$(photo_of $MALS)"
check "Mallory can't open the photo, nor can anyone else" "0|0|0" "$(opens $M $A/secret.jpg)|$(opens $C $A/secret.jpg)|$(opens anon $A/secret.jpg)"
as $M "insert into public.isms (loved_one_id, text, visibility) values ('$MALS', 'Hello everyone.', 'public')" > /dev/null
$PSQL -c "update public.loved_ones set visibility = 'private' where id = '$MALS'" > /dev/null
check "nor through a quote of hers shared with everyone" "0|0|0" "$(opens $M $A/secret.jpg)|$(opens $C $A/secret.jpg)|$(opens anon $A/secret.jpg)"
$PSQL -q -f ../schema.sql > /dev/null 2>&1
check "running the schema again clears it and puts the rule back" "(none)|1" "$(photo_of $MALS)|$(rule_in_place)"
check "Ann's loved ones keep their photos" "$A/new.jpg|$A/secret.jpg|$A/public.jpg|$A/grandma.jpg" "$(photo_of $AUNT)|$(photo_of $SECRET)|$(photo_of $PUBLIC)|$(photo_of $GRANDMA)"

finish
