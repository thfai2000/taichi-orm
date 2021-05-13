CREATE TABLE `color` (
`id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY
);
CREATE TABLE `product` (
`id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
`name` varchar(255) NOT NULL,
`createdAt` datetime NULL,
`shopId` integer
);
CREATE TABLE `shop` (
`id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY
);