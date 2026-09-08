-- Seed de docentes y usuarios para el despliegue en Render
-- Generado automaticamente desde la base local. Idempotente.

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '17111ab6-ae65-4f27-b10f-d51dfbadec79', 'Adalberto de Jesús', 'González Peña', '92187051',
       'biomagno1965@gmail.com', '3183749714', '$2b$12$5rNUs1F.m/38UCR8FoLMAe/o1BSkzxA0o80F2miRCnZWVL9yrc/Te', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '92187051' OR u."email" = 'biomagno1965@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '683d4171-85fc-4af7-9271-65b62232ebdf', 'Alexander', 'Bueno Charris', '72209347',
       'alexanderbueno@idetp.edu.co', '3008027345', '$2b$12$hWS/4xDjtW7obmP93IVy1u2sJQNJLmJIv0gm4y0uNM.RpMpqPkhA2', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72209347' OR u."email" = 'alexanderbueno@idetp.edu.co');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '20c26224-4e15-4042-aba6-40484d5e2937', 'Ana Cecilia', 'Cortes Rojano', '22481518',
       'ancor015701@hotmail.com', '3202050147', '$2b$12$l12JHE8nULUp4pwtLnLb8..kffvV13sfd/F4H7kwSyFh6yHteS5hS', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '22481518' OR u."email" = 'ancor015701@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'ef57dcdc-3e0a-4474-b933-74c6ca5dce36', 'Angélica María', 'Rebolledo Vergel', '32795873',
       'angelicar2708@gmail.com', '3156835094', '$2b$12$hFeUdVTvYYXJWvCfjv3Yy.2./fIdL38X3bZMY4jC6mztPfQHE9zWW', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32795873' OR u."email" = 'angelicar2708@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'c070ab02-6bd0-4920-945c-cf2e94e76f50', 'Bleidys Mercedes', 'Torres Infante', '49729334',
       'bletorin@hotmail.com', '3017755794', '$2b$12$ESaEzmIjO8F2fqHM2dSlnORqPBDUDKynUPpAEIjkx4qFZNmIBMCLC', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '49729334' OR u."email" = 'bletorin@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '9d6a990c-05f8-488f-8871-56e50cfb57f9', 'Candelaria Isabel Caballero', 'De Ávila', '22675219',
       'canditaisa@gmail.com', '3106828338', '$2b$12$x8fKUjQKbKs8s4ehfS/qGe5oo3fAfotSwSvlPFXmpOcP46k1IUaxC', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '22675219' OR u."email" = 'canditaisa@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '0420863f-3b4a-42ee-82ec-8b0e196f85d3', 'Carlos Octavio', 'Arevalo Araujo', '8761355',
       'carlosarevaloaraujo@gmail.com', '3016842846', '$2b$12$0vhX7dINrysCz2SW7GNw0u8CwVOJbpBn8gPewMozKqvTiNyQ6M4lG', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '8761355' OR u."email" = 'carlosarevaloaraujo@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'fe7c8a61-5da9-4e96-834d-a61cccdb4db6', 'Cesar Arce', 'Duran Perez', '72258378',
       'arcedurancho@hotmail.com', '3013382984', '$2b$12$6GbgWxHZ2pKhWP26Y5KRfOEOpS.69JIimQ6ybLstfoLYepwd7ySW6', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72258378' OR u."email" = 'arcedurancho@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '5648c787-b396-42ed-aa06-741367227394', 'Constanza', 'Galeano Alvear', '51769743',
       'cony-1465@hotmail.com', '3015413795', '$2b$12$RBEUOj8yV5M3O8MuLh92wuigNx6dtz2FKKYRHOOEmmSLJT0VHBzjy', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '51769743' OR u."email" = 'cony-1465@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '4612ad68-d0da-4117-8927-56cd6e4f6d01', 'Deisy Patricia', 'Guerrero Morales', '32863638',
       'gdeisipatricia@gmail.com', '3013181320', '$2b$12$Q.zQVi0eouYpxWm8SNJekegJT9CljjF0.R.6EUmJREsYNlJMo/ckS', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32863638' OR u."email" = 'gdeisipatricia@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '5817de08-0a92-44eb-875f-472e66b3a2fc', 'Diana Margarita', 'Hernández Acuña', '32771583',
       'dhernandezbar07@gmail.com', '3152166998', '$2b$12$fZGZbBrFD4BmtKKEGIJg2uFrmAIqN7u8aid2lxH.r4bNZok3mess.', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32771583' OR u."email" = 'dhernandezbar07@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '029f3877-0960-4857-bf0d-e7596791b176', 'Eugenia Patricia', 'Medina Florez', '32885512',
       'medinaeugenia29@gmail.com', '3013244996', '$2b$12$n2Fadfq87TvwOMQapXjo6e2c65O2.dFi8strMw2KjOErtY1iUTYg.', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32885512' OR u."email" = 'medinaeugenia29@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '454198b1-13a7-48dc-8b53-8bce1b5a6a6a', 'Fredy Miguel', 'Rolon Barrios', '8751494',
       'fredyrolong@hotmail.com', '3106400281', '$2b$12$FknNL9DYnxO1P2rLCMeJu.vKXrXMwP/5xtYEes3axkQshfq2SmLaK', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '8751494' OR u."email" = 'fredyrolong@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '795d8178-8d90-4125-97bd-3cef43e54fa1', 'Ingrid de Jesús', 'Escorcia Crespo', '32819979',
       'ingridescor@hotmail.com', '3103636069', '$2b$12$Eg2Y3tNzerTE.jpfqooysOiShruudaMDlWBd2N64Feak.Cu0Y56kq', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32819979' OR u."email" = 'ingridescor@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '9ae08f70-8b5a-4f46-97bd-d37707b9819b', 'Ivan Alexander', 'Rodriguez Santrich', '72246139',
       'ivanrs1979@hotmail.com', '3004376133', '$2b$12$h9yaTs5X2Cqp2HYx2CMl5uKgVvSl3qAial.rKl.JEYLGUndxsNqvq', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72246139' OR u."email" = 'ivanrs1979@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'c7d54341-816b-444d-b857-53060eb1414a', 'Jorge Isaac', 'García Bolivar', '8700120',
       'jogabo_1960@hotmail.com', '3163116732', '$2b$12$BHBImeW9SoZdvuRIMvaLrurUntBQvbwmnh.zFYcN5BEA7sJJvYu/y', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '8700120' OR u."email" = 'jogabo_1960@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '7f5b132c-babc-4015-914e-ebea064e123b', 'Jose', 'Castillo Nieto', '12642129',
       'Jcastini@hotmail.com', '3107263778', '$2b$12$96YDvPYDAOC0nsjqtavKw..Q8YVLiubjytwCpSA7Q5VOHxb9FloIK', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '12642129' OR u."email" = 'Jcastini@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'b941f7ea-21d4-469f-b745-32605428d90c', 'Karina Esther', 'Viloria Martínez', '22606425',
       'karyviloria@hotmail.com', '3013329823', '$2b$12$35ood1OQjSevXHQBu1OtOu9F3e/iRhFRByZ7WAys1M8grC1w2tMC6', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '22606425' OR u."email" = 'karyviloria@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'e3d6acd7-dd35-4a91-b92d-d3313761d31d', 'Keyla Patricia', 'Paola Escorcia', '1143136625',
       'patriciap_1028@hotmail.com', '3007337152', '$2b$12$j0cipwqb6qIVDi7ezku35.AVNhp7AyVKaeuSrUrpcbWzILSCsmxuW', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1143136625' OR u."email" = 'patriciap_1028@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'bc952e08-949a-4f07-ba4c-fab540e357dc', 'Leidys Xiomara', 'Quintero Romo', '22600312',
       'xiomaraxl26@gmail.com', '3114118710', '$2b$12$ftf0ouY86bxuy35wRGli0OKWU1sWdPkS4PTlvRce9u6siIN5pqz9K', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '22600312' OR u."email" = 'xiomaraxl26@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'b0a3e57f-ad8d-4643-bd56-d4687d79b9db', 'Lenis María', 'Freyle Zurita', '32875873',
       'Lenismarif@gmail.com', '3145153498', '$2b$12$kbyM2AtmPVBP3X3q68w6B.2chXBewswXsxIbmKfzRnZ.xE6kRW5AW', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32875873' OR u."email" = 'Lenismarif@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '8c015235-7d1c-459e-8834-786bab9286c3', 'Lennys Esther', 'Lamadrid Bacca', '55222827',
       'lennyslamadrid@gmail.com', '3103575901', '$2b$12$e.91zR./XMLkZfYd0eijXu1FsbEY67DjXWB9kEZxxqQJkLxhxuVg.', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '55222827' OR u."email" = 'lennyslamadrid@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'bd0a7bfd-a19d-485f-b3ba-35e56da9df6e', 'María del Rosario', 'Muñoz Rambal', '32867970',
       'Mm6916994@gmail.com', '3017758937', '$2b$12$CspwPY.lYJJn.325gZHku.D/TR22aykNy9eT0oBKOoku8UGs9Usdm', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32867970' OR u."email" = 'Mm6916994@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '6d832de1-b10a-4d71-bfd8-fd6e3a56fad7', 'Marta De', 'Armas Gonzalez', '45489453',
       'marfina19@hotmail.com', '3013501899', '$2b$12$R.B9yEg.CB2ew8L1icjCvOsdH2BOhmvQQcHtxZOfvfYhgOBhngbZO', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '45489453' OR u."email" = 'marfina19@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '3b226558-3ac8-455f-9d75-dc47477ad588', 'Maryoris Paola', 'Alonso Armenta', '32896055',
       'maryorisalonso3@gmail.com', '3177154696', '$2b$12$SHp1jMemmjo0C5wjCZvVQ.dApguPkTqWI9/BagAJ67bbkKvvFF3F2', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32896055' OR u."email" = 'maryorisalonso3@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'b48990f9-15d8-444d-93fc-dcacfd0805b8', 'Milton', 'Villacob Rangel', '8691722',
       'janmilt29@yahoo.com', '3243855443', '$2b$12$yjO5/qD7rX04Ocg8DYuUlelQP36h0bwAT054OZtiV57N6.rKyXICa', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '8691722' OR u."email" = 'janmilt29@yahoo.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '526259c9-32c0-442a-a319-a9d1ec5e5e76', 'Orlando', 'Peña Fernández', '3759757',
       'opefe1966@gmail.com', '3759757', '$2b$12$9scs54LGKJteuTikmQsmdOA5o7aUZWtKvR1f.6WQNNcMYyL4kyZre', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '3759757' OR u."email" = 'opefe1966@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '0420ffc0-11dc-41b8-9169-34bcbbc6ebe9', 'Rosalba', 'Marriaga Lopez', '32734821',
       'rosalbamarriaga01@gmail.com', '3116687120', '$2b$12$3A4pU2tr7fjBAkQ3Baz0zOWAo/ZOPNSBj5vF9MOtsYZ4VUuPhgsau', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '32734821' OR u."email" = 'rosalbamarriaga01@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'fb9e3937-e3b9-4540-ba2c-6acaa792ec00', 'Ruby Del Carmen', 'García Mora', '22455692',
       'rugamora@gmail.com', '3014864842', '$2b$12$nwTvOMYEeFXZQMCGTqdrFex8dhKITQ9a7CiAMj1aTuDiz5JkyCT9m', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '22455692' OR u."email" = 'rugamora@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'dd81013e-404d-48d2-9448-544fca758c96', 'Segundo Manuel', 'Castillo Nieto', '12640840',
       'scastillobar07@gmail.com', '3004254636', '$2b$12$FqRY0VEN1jAzSr3d1Mx/8ORNnwIeE0XJhbfkWHuUUk.GpbGdLjY4u', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '12640840' OR u."email" = 'scastillobar07@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'f274db57-0ebf-46d3-848c-67d48a7869a6', 'Jesus David De', 'Arcos Cuello', '1042440186',
       'jdaviddearcos@gmail.com', '3045706136', '$2b$12$W3j8KEEn7qvxvlnxY1f4suJ7wk/KI0gDoLfgVc1Qp0sP/TCy.b6y2', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1042440186' OR u."email" = 'jdaviddearcos@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '88814b41-b56b-4134-bae7-6e8f42f5c44a', 'Juan Chivirico', 'Herrera Valdez', '1010030831',
       'lic.mat.chiviriko@gmail.com', '3005212154', '$2b$12$FQ/j1ixvvP2pBbFTtzqWyO7d0pIGfwpu50n72Bg.UEGdFguS66k5O', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1010030831' OR u."email" = 'lic.mat.chiviriko@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '64e22f49-2917-4edf-8899-f49d4f4449fc', 'Isaac', 'Sarmiento Acosta', '1129531678',
       'acosta.sarmiento.isaac@gmail.co', '3012306965', '$2b$12$QnhkWCPIUOCqZ4Vm72J6CepxQbID7aEkHUFVM6L2QiRvdW8wZ40X2', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1129531678' OR u."email" = 'acosta.sarmiento.isaac@gmail.co');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'bae4b2a4-43d6-4e11-89c5-820358c458dd', 'Rodrigo Jesús', 'Rodriguez Rodriguez', '1043013551',
       'rodrigorodrig42@outlook.es', '3136038002', '$2b$12$7ofhfHyMFyvHvMIlz/on6OmDUZ4seAm.EWv2PI/uAHiaJ9XiOAqRG', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1043013551' OR u."email" = 'rodrigorodrig42@outlook.es');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '00926941-0b93-40d3-9228-247a1fc695cb', 'Yeimy José', 'Plaza Silvera', '72192571',
       'jeplasil@hotmail.com', '3103501516', '$2b$12$sTug3EkwuvFi.TanBm78ZOBm07AcYapUcThuNaRcM1HaJweE6iir.', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72192571' OR u."email" = 'jeplasil@hotmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '4a00a196-6f6c-43f6-87aa-6a4c03fa7dcc', 'Emma Cecilia', 'Maldonado Ariza', '1129509561',
       'emma.maldonado@sedbarranquilla.edu.co', '3173089986', '$2b$12$vR6tt1HGTRMnwJIMOYhm/eMuK6WbpNbbqjJ/Ke3DCmt0kjsQ6RDHe', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1129509561' OR u."email" = 'emma.maldonado@sedbarranquilla.edu.co');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '11a89016-a1a1-41fa-9ad7-149d260a8f3a', 'Caroly Janey', 'Caballero Puello', '1047341143',
       'cjcaballerop@gmail.com', '3164981131', '$2b$12$1u3GBWlQzDSMaBJTVncurOv/OueT/1uQd1qrqnGDo7kYrrVzvTzVi', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1047341143' OR u."email" = 'cjcaballerop@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '4784b8b4-8187-4bee-9e6d-9d55a52543b3', 'Carlos Eliecer', 'Tovar Castillo', '72227993',
       'carlostc77@yahoo.com', '3116960193', '$2b$12$OikPczAWBnwBJ9dJAkxpXedBtx5UI8PpR1s5ZTYP4fZxX.tw5KMAK', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72227993' OR u."email" = 'carlostc77@yahoo.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'd73a5466-d1c0-4eef-abd7-8086fab57708', 'Camila Andrea', 'Cantillo Pla', '1010106331',
       'camilaandrea301c@gmail.com', '3016126174', '$2b$12$D.ajyNC9b/2sINg9TIGSCeEJFdaEHqYdaRW2zDqdCLJCNZKpf/Vei', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '1010106331' OR u."email" = 'camilaandrea301c@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT '0509d5a8-1e9e-41a7-96d8-f47f41aea512', 'Peter hans', 'gomez orduz', '72187714',
       'Pgomezorduz@gmail.com', '3154697978', '$2b$12$Pvp9VykuNOjpEiYzaM.XveWkp4EYAr2Rmt3FhYX2b.HIReKae7zfa', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72187714' OR u."email" = 'Pgomezorduz@gmail.com');

INSERT INTO "users" ("id", "first_name", "last_name", "document",
                       "email", "phone", "password", "status", "role_id",
                       "must_change_password", "created_at", "updated_at")
SELECT 'c7c64674-6251-40ad-9c75-a55212194e26', 'Reynaldo Alfonso', 'Gómez Pulgar', '72165224',
       'reynelf9@gmail.com', '3107251457', '$2b$12$/IgZni1wAB4BOxlJgfPSvuTYVUiVm.qMjOFsgPlMGumKatduhrH7O', 'ACTIVE', r."id", TRUE, NOW(), NOW()
FROM "roles" r WHERE r."code" = 'DOCENTE' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '72165224' OR u."email" = 'reynelf9@gmail.com');

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('14c0c636-9ed6-4f75-b07f-bb77f465e89b', 'DOC-0001', 'Adalberto de Jesús', 'González Peña',
        '92187051', 'biomagno1965@gmail.com', '3183749714', 'ACTIVE', '17111ab6-ae65-4f27-b10f-d51dfbadec79', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('eb1fc470-f933-408c-b892-2696cf6f55f0', 'DOC-0002', 'Alexander', 'Bueno Charris',
        '72209347', 'alexanderbueno@idetp.edu.co', '3008027345', 'ACTIVE', '683d4171-85fc-4af7-9271-65b62232ebdf', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('6176c755-ad18-4899-b0f3-003af9f05568', 'DOC-0003', 'Ana Cecilia', 'Cortes Rojano',
        '22481518', 'ancor015701@hotmail.com', '3202050147', 'ACTIVE', '20c26224-4e15-4042-aba6-40484d5e2937', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('615f7c87-566e-4207-a9fe-b0057bef3da1', 'DOC-0004', 'Angélica María', 'Rebolledo Vergel',
        '32795873', 'angelicar2708@gmail.com', '3156835094', 'ACTIVE', 'ef57dcdc-3e0a-4474-b933-74c6ca5dce36', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('78a5cfa2-1cf5-4f93-9cd3-9e53468379d1', 'DOC-0005', 'Bleidys Mercedes', 'Torres Infante',
        '49729334', 'bletorin@hotmail.com', '3017755794', 'ACTIVE', 'c070ab02-6bd0-4920-945c-cf2e94e76f50', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('2908f1d6-a94b-4627-861c-a3975ba753f6', 'DOC-0006', 'Candelaria Isabel Caballero', 'De Ávila',
        '22675219', 'canditaisa@gmail.com', '3106828338', 'ACTIVE', '9d6a990c-05f8-488f-8871-56e50cfb57f9', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('66f050a6-8b51-44f3-881c-f9f6b768fd3e', 'DOC-0007', 'Carlos Octavio', 'Arevalo Araujo',
        '8761355', 'carlosarevaloaraujo@gmail.com', '3016842846', 'ACTIVE', '0420863f-3b4a-42ee-82ec-8b0e196f85d3', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('dcf4faf3-db5f-461d-9be8-a73672b5933c', 'DOC-0008', 'Cesar Arce', 'Duran Perez',
        '72258378', 'arcedurancho@hotmail.com', '3013382984', 'ACTIVE', 'fe7c8a61-5da9-4e96-834d-a61cccdb4db6', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('459dd0e7-3d11-4b9c-81e5-a50f07ed5eb3', 'DOC-0009', 'Constanza', 'Galeano Alvear',
        '51769743', 'cony-1465@hotmail.com', '3015413795', 'ACTIVE', '5648c787-b396-42ed-aa06-741367227394', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('5dab9f1f-ea19-478e-beb9-ec8543d7f9dd', 'DOC-0010', 'Deisy Patricia', 'Guerrero Morales',
        '32863638', 'gdeisipatricia@gmail.com', '3013181320', 'ACTIVE', '4612ad68-d0da-4117-8927-56cd6e4f6d01', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('1e7593ca-a908-40b8-8824-7dbe904782a2', 'DOC-0011', 'Diana Margarita', 'Hernández Acuña',
        '32771583', 'dhernandezbar07@gmail.com', '3152166998', 'ACTIVE', '5817de08-0a92-44eb-875f-472e66b3a2fc', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('7136bcea-6c64-4d25-b3f8-e7f941700ad2', 'DOC-0012', 'Eugenia Patricia', 'Medina Florez',
        '32885512', 'medinaeugenia29@gmail.com', '3013244996', 'ACTIVE', '029f3877-0960-4857-bf0d-e7596791b176', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('fc80d107-3458-40b8-aa66-33d35ca905db', 'DOC-0013', 'Fredy Miguel', 'Rolon Barrios',
        '8751494', 'fredyrolong@hotmail.com', '3106400281', 'ACTIVE', '454198b1-13a7-48dc-8b53-8bce1b5a6a6a', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('c4819359-96b9-4199-ac66-6007296983e8', 'DOC-0014', 'Ingrid de Jesús', 'Escorcia Crespo',
        '32819979', 'ingridescor@hotmail.com', '3103636069', 'ACTIVE', '795d8178-8d90-4125-97bd-3cef43e54fa1', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('4389413b-9f79-4e6e-aa5b-e7ee5d822db7', 'DOC-0015', 'Ivan Alexander', 'Rodriguez Santrich',
        '72246139', 'ivanrs1979@hotmail.com', '3004376133', 'ACTIVE', '9ae08f70-8b5a-4f46-97bd-d37707b9819b', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('2fcacdf9-2030-4d36-9c18-8675eae3a44b', 'DOC-0016', 'Jorge Isaac', 'García Bolivar',
        '8700120', 'jogabo_1960@hotmail.com', '3163116732', 'ACTIVE', 'c7d54341-816b-444d-b857-53060eb1414a', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('3c8207f2-afa3-4365-9b42-00ba7712449b', 'DOC-0017', 'Jose', 'Castillo Nieto',
        '12642129', 'Jcastini@hotmail.com', '3107263778', 'ACTIVE', '7f5b132c-babc-4015-914e-ebea064e123b', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('9905942c-8231-4d23-a709-a3ec21f09208', 'DOC-0018', 'Karina Esther', 'Viloria Martínez',
        '22606425', 'karyviloria@hotmail.com', '3013329823', 'ACTIVE', 'b941f7ea-21d4-469f-b745-32605428d90c', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('35518456-9d6b-475b-bd8c-ead090cb7619', 'DOC-0019', 'Keyla Patricia', 'Paola Escorcia',
        '1143136625', 'patriciap_1028@hotmail.com', '3007337152', 'ACTIVE', 'e3d6acd7-dd35-4a91-b92d-d3313761d31d', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('c25c2917-371f-434b-8a19-f0720d3afca9', 'DOC-0020', 'Leidys Xiomara', 'Quintero Romo',
        '22600312', 'xiomaraxl26@gmail.com', '3114118710', 'ACTIVE', 'bc952e08-949a-4f07-ba4c-fab540e357dc', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('f5e16e79-087d-44ad-b7e6-b4d69bb45836', 'DOC-0021', 'Lenis María', 'Freyle Zurita',
        '32875873', 'Lenismarif@gmail.com', '3145153498', 'ACTIVE', 'b0a3e57f-ad8d-4643-bd56-d4687d79b9db', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('c9afa477-097e-43fc-962d-5751d9c4244c', 'DOC-0022', 'Lennys Esther', 'Lamadrid Bacca',
        '55222827', 'lennyslamadrid@gmail.com', '3103575901', 'ACTIVE', '8c015235-7d1c-459e-8834-786bab9286c3', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('beb513d5-f93f-48b3-a58e-ede1d034fc81', 'DOC-0023', 'María del Rosario', 'Muñoz Rambal',
        '32867970', 'Mm6916994@gmail.com', '3017758937', 'ACTIVE', 'bd0a7bfd-a19d-485f-b3ba-35e56da9df6e', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('729de040-755b-4e35-9ab0-7bd32bafacbf', 'DOC-0024', 'Marta De', 'Armas Gonzalez',
        '45489453', 'marfina19@hotmail.com', '3013501899', 'ACTIVE', '6d832de1-b10a-4d71-bfd8-fd6e3a56fad7', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('74844dff-4462-4f90-8238-eb9269b27c2e', 'DOC-0025', 'Maryoris Paola', 'Alonso Armenta',
        '32896055', 'maryorisalonso3@gmail.com', '3177154696', 'ACTIVE', '3b226558-3ac8-455f-9d75-dc47477ad588', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('26bd6f02-6f05-4a04-9f5f-b8e1e1952c09', 'DOC-0026', 'Milton', 'Villacob Rangel',
        '8691722', 'janmilt29@yahoo.com', '3243855443', 'ACTIVE', 'b48990f9-15d8-444d-93fc-dcacfd0805b8', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('ad3a8a43-a5fd-4237-bc58-c368151bd0d9', 'DOC-0027', 'Orlando', 'Peña Fernández',
        '3759757', 'opefe1966@gmail.com', '3759757', 'ACTIVE', '526259c9-32c0-442a-a319-a9d1ec5e5e76', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('6347e035-4d99-4a04-a8f1-e826f8684ed1', 'DOC-0028', 'Rosalba', 'Marriaga Lopez',
        '32734821', 'rosalbamarriaga01@gmail.com', '3116687120', 'ACTIVE', '0420ffc0-11dc-41b8-9169-34bcbbc6ebe9', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('a6800488-6a43-4eb0-bbd4-198e41ca06a0', 'DOC-0029', 'Ruby Del Carmen', 'García Mora',
        '22455692', 'rugamora@gmail.com', '3014864842', 'ACTIVE', 'fb9e3937-e3b9-4540-ba2c-6acaa792ec00', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('fac9de61-d2e7-41a2-a697-67a7b46a33e1', 'DOC-0030', 'Segundo Manuel', 'Castillo Nieto',
        '12640840', 'scastillobar07@gmail.com', '3004254636', 'ACTIVE', 'dd81013e-404d-48d2-9448-544fca758c96', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('bf80d990-d60e-45af-9607-9da9a1c2090d', 'DOC-0031', 'Jesus David De', 'Arcos Cuello',
        '1042440186', 'jdaviddearcos@gmail.com', '3045706136', 'ACTIVE', 'f274db57-0ebf-46d3-848c-67d48a7869a6', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('da22a86d-f970-4259-b52e-a1f950550b6b', 'DOC-0032', 'Juan Chivirico', 'Herrera Valdez',
        '1010030831', 'lic.mat.chiviriko@gmail.com', '3005212154', 'ACTIVE', '88814b41-b56b-4134-bae7-6e8f42f5c44a', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('0f07e225-dd91-42d5-94a3-0f003a7a6874', 'DOC-0033', 'Isaac', 'Sarmiento Acosta',
        '1129531678', 'acosta.sarmiento.isaac@gmail.co', '3012306965', 'ACTIVE', '64e22f49-2917-4edf-8899-f49d4f4449fc', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('c313822d-6876-4b51-9491-75bb15ac152a', 'DOC-0034', 'Rodrigo Jesús', 'Rodriguez Rodriguez',
        '1043013551', 'rodrigorodrig42@outlook.es', '3136038002', 'ACTIVE', 'bae4b2a4-43d6-4e11-89c5-820358c458dd', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('68845927-69a1-4c27-aa3e-335c267ad082', 'DOC-0035', 'Yeimy José', 'Plaza Silvera',
        '72192571', 'jeplasil@hotmail.com', '3103501516', 'ACTIVE', '00926941-0b93-40d3-9228-247a1fc695cb', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('1c83702e-d1cb-4ee9-aebf-eb3fbdff645f', 'DOC-0036', 'Emma Cecilia', 'Maldonado Ariza',
        '1129509561', 'emma.maldonado@sedbarranquilla.edu.co', '3173089986', 'ACTIVE', '4a00a196-6f6c-43f6-87aa-6a4c03fa7dcc', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('f77eabf2-d3b3-4852-9b81-65a1df8af8dd', 'DOC-0037', 'Caroly Janey', 'Caballero Puello',
        '1047341143', 'cjcaballerop@gmail.com', '3164981131', 'ACTIVE', '11a89016-a1a1-41fa-9ad7-149d260a8f3a', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('c90ae12d-8c54-465d-8c87-574c1d892e24', 'DOC-0038', 'Carlos Eliecer', 'Tovar Castillo',
        '72227993', 'carlostc77@yahoo.com', '3116960193', 'ACTIVE', '4784b8b4-8187-4bee-9e6d-9d55a52543b3', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('c523a544-ff41-468c-bd4d-9aecd12c7bb2', 'DOC-0039', 'Camila Andrea', 'Cantillo Pla',
        '1010106331', 'camilaandrea301c@gmail.com', '3016126174', 'ACTIVE', 'd73a5466-d1c0-4eef-abd7-8086fab57708', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('880fef10-fd47-4be3-a95d-7607ee8e4dc4', 'DOC-0040', 'Peter hans', 'gomez orduz',
        '72187714', 'Pgomezorduz@gmail.com', '3154697978', 'ACTIVE', '0509d5a8-1e9e-41a7-96d8-f47f41aea512', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;

INSERT INTO "teachers" ("id", "code", "first_name", "last_name",
                          "document", "email", "phone", "status",
                          "user_id", "created_at", "updated_at")
VALUES ('937d3308-e917-43e2-8f7b-5c311dc24c60', 'DOC-0041', 'Reynaldo Alfonso', 'Gómez Pulgar',
        '72165224', 'reynelf9@gmail.com', '3107251457', 'ACTIVE', 'c7c64674-6251-40ad-9c75-a55212194e26', NOW(), NOW())
ON CONFLICT ("document") DO NOTHING;
