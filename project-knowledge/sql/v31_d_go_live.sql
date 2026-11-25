-- v31 (part D): run right AFTER the v31 front end is deployed.
-- The new self-collection tests and worker packages were kept hidden so the older (v30) screens
-- could not create kit orders they cannot finish.
update public.tests set active = true where id in ('urine','ucult','fit','hpylori','stoolop','hpvself','resp','igra');
update public.packages set active = true where id in ('selfkit','expat_pre','housemaid');
update public.tests set collection = 'self' where id = 'uacr';
