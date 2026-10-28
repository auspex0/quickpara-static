-- DEMO products for local testing only. Do NOT run this in production.
-- Categories 1..6 come from schema.sql (Visage, Corps, Bébé, Compléments, Hygiène, Premiers soins).

INSERT INTO products (name, brand, category_id, price, description, visible, created_at) VALUES
('Gel nettoyant purifiant', 'Marque exemple', 1, 129, 'Peaux mixtes à grasses, 200 ml', 1, 1),
('Crème hydratante visage SPF 50', 'Marque exemple', 1, 169, 'Protection solaire quotidienne, 50 ml', 1, 2),
('Sérum éclat vitamine C', 'Marque exemple', 1, 249, 'Anti-taches, 30 ml', 1, 3),
('Lait corporel nourrissant', 'Marque exemple', 2, 95, 'Peaux sèches, 400 ml', 1, 4),
('Shampooing doux usage fréquent', 'Marque exemple', 2, 79, 'Tous types de cheveux, 250 ml', 1, 5),
('Crème change bébé', 'Marque exemple', 3, 69, 'Apaise et protège, 100 ml', 1, 6),
('Lait de toilette bébé', 'Marque exemple', 3, 85, 'Sans rinçage, 500 ml', 1, 7),
('Vitamine D3 gouttes', 'Marque exemple', 4, 110, 'Flacon 20 ml', 1, 8),
('Magnésium + B6', 'Marque exemple', 4, 135, 'Boîte de 60 comprimés', 1, 9),
('Gel hydroalcoolique', 'Marque exemple', 5, 29, 'Flacon pompe, 300 ml', 1, 10),
('Dentifrice protection gencives', 'Marque exemple', 5, 39, 'Tube 75 ml', 1, 11),
('Pansements assortis', 'Marque exemple', 6, 25, 'Boîte de 40', 1, 12),
('Thermomètre digital', 'Marque exemple', 6, 79, 'Lecture rapide, embout souple', 1, 13),
('Compresses stériles', 'Marque exemple', 6, 19, 'Sachet de 10, 10×10 cm', 1, 14);
