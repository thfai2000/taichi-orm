insert into `shop` (`id`, `location`) values (null, 'Hong Kong'), (null, 'London'), (null, 'New York');
insert into `product` (name, `shop_id`, `created_at`) values 
('a', 1, NOW()), ('b', 1, NOW()), ('c',1, NOW()),
('d', 2, NOW()), ('e', 2, NOW()), ('f',2, NOW());
insert into `color` (`code`, `product_id`) values
('yellow', 1), ('red', 1), ('green',1),
('yellow', 2), ('red', 2), ('green',2),
('yellow', 3), ('red', 3), ('green',3);