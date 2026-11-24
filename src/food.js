/* Nutrition: offline food table, German free-text recognition, day totals and factors for the health patterns. */
(function (root) {
  'use strict';

  // ---------- Food table ----------
  // Values per 100 g (or 100 ml), rounded averages from public nutrition tables.
  // [names, kcal, protein, carbs, fat, fibre, default portion in g, units, category, flags]
  // units: st piece, x bare count ("2 Eier"), sch slice, el/tl spoon, gl glass, ta cup, be tub, do can, pk pack, po portion,
  //        hv handful, ri bar, ku scoop, fl bottle, ms measuring scoop, ze clove, s portion after "mit", h portion after a hot drink
  // flags: d drink (ml), h hot drink, k coffee, a alcohol, z garlic or onion, w water or tea, i nothing worth logging
  const T = [
    // Eggs and dairy
    ['Ei|Eier|Hühnerei|Hühnereier|Frühstücksei|Frühstückseier|gekochtes Ei|gekochte Eier|hartgekochtes Ei|hartgekochte Eier|weiches Ei|pochiertes Ei', 145, 12.6, 0.7, 9.9, 0, 55, 'st:55,x:55,s:55', 'ei', ''],
    ['Rührei|Rühreier|Eierspeise|Eierspeis', 170, 11, 1.5, 13.5, 0, 130, 'po:130', 'ei', ''],
    ['Spiegelei|Spiegeleier', 195, 13.5, 0.8, 15, 0, 60, 'st:60,s:60', 'ei', ''],
    ['Omelett|Omelette', 155, 10.5, 1, 12, 0, 150, 'st:150', 'ei', ''],
    ['Eiklar|Eiklar flüssig|flüssiges Eiweiß|Eiweiß flüssig|Hühnereiweiß|Eiweiß', 48, 11, 0.7, 0.2, 0, 100, 'st:33', 'ei', ''],
    ['Milch|Vollmilch|Kuhmilch|Frischmilch|H-Milch', 64, 3.3, 4.8, 3.5, 0, 200, 'gl:200,ta:200,be:250,el:15,s:150,h:30', 'milch', 'd'],
    ['fettarme Milch|Milch fettarm|teilentrahmte Milch|Magermilch|entrahmte Milch', 46, 3.4, 4.9, 1.5, 0, 200, 'gl:200,ta:200,be:250,el:15,s:150,h:30', 'milch', 'd'],
    ['Haferdrink|Hafermilch', 46, 0.8, 7, 1.5, 0.8, 200, 'gl:200,ta:200,be:250,s:150,h:30', 'milch', 'd'],
    ['Sojadrink|Sojamilch', 39, 3.3, 1.5, 1.9, 0.5, 200, 'gl:200,ta:200,be:250,s:150,h:30', 'milch', 'd'],
    ['Mandeldrink|Mandelmilch', 24, 0.5, 3, 1.1, 0.3, 200, 'gl:200,be:250,s:150,h:30', 'milch', 'd'],
    ['Kokosmilch|Kokoscreme', 180, 1.5, 3, 18, 0, 100, 'el:15,do:400,s:100', 'fett', ''],
    ['Joghurt|Naturjoghurt|Jogurt|Joghurt natur|Vollmilchjoghurt', 66, 3.8, 4.4, 3.5, 0, 150, 'be:150,el:20,s:100', 'milch', ''],
    ['Fruchtjoghurt|Erdbeerjoghurt|Vanillejoghurt|Joghurt mit Früchten', 95, 3.4, 13, 3, 0.2, 150, 'be:150,el:20,s:100', 'milch', ''],
    ['fettarmer Joghurt|Joghurt fettarm|Magerjoghurt|Joghurt mager', 47, 4, 4.5, 1.5, 0, 150, 'be:150,el:20,s:100', 'milch', ''],
    ['griechischer Joghurt|Joghurt griechischer Art|griechischer Jogurt|Greek Yogurt', 120, 6, 4, 9, 0, 150, 'be:150,el:20,s:100', 'milch', ''],
    ['Skyr|Skyr natur', 63, 11, 4, 0.2, 0, 150, 'be:150,el:20,s:100', 'milch', ''],
    ['Proteinjoghurt|High-Protein-Joghurt|Protein-Joghurt|Eiweißjoghurt', 62, 10, 4.5, 0.3, 0, 200, 'be:200,el:20', 'protein', ''],
    ['Magerquark|Quark mager|Speisequark mager', 67, 12, 4, 0.3, 0, 250, 'pk:250,be:250,el:25,s:125', 'milch', ''],
    ['Quark|Speisequark|Halbfettquark|Sahnequark', 109, 12.5, 3.2, 5, 0, 250, 'pk:250,be:250,el:25,s:125', 'milch', ''],
    ['Quarkspeise|Quarkcreme|Obstquark|Fruchtquark|Quarkdessert', 125, 7.5, 15, 3.8, 0.5, 150, 'be:150,po:150,s:100', 'milch', ''],
    ['Hüttenkäse|körniger Frischkäse|Cottage Cheese', 98, 12.5, 2.6, 4.3, 0, 200, 'be:200,el:25,s:100', 'milch', ''],
    ['Frischkäse|Doppelrahmfrischkäse|Rahmfrischkäse|Frischkäse natur', 260, 5.6, 3.3, 25, 0, 30, 'el:20,tl:8,pk:200,s:25', 'milch', ''],
    ['Frischkäse light|leichter Frischkäse|Frischkäse fettarm', 150, 9, 4.5, 11, 0, 30, 'el:20,tl:8,pk:200,s:25', 'milch', ''],
    ['Käse|Gouda|Edamer|Butterkäse|Tilsiter|Scheibenkäse|Schnittkäse|Maasdamer|Käsescheibe|Käsescheiben|Raclettekäse|Raclette Käse', 356, 25, 0, 28, 0, 25, 'sch:25,st:25,s:25', 'milch', ''],
    ['Emmentaler|Bergkäse|Appenzeller|Comté|Gruyère|Allgäuer', 390, 28, 0, 31, 0, 25, 'sch:25,st:25,s:25', 'milch', ''],
    ['Mozzarella|Büffelmozzarella', 250, 18, 1, 19, 0, 125, 'ku:125,pk:125,sch:25,s:60', 'milch', ''],
    ['Mozzarella light|leichter Mozzarella', 165, 19, 1, 9.5, 0, 125, 'ku:125,pk:125,s:60', 'milch', ''],
    ['Feta|Schafskäse|Hirtenkäse|Fetakäse|Salatkäse', 265, 16, 0.7, 21, 0, 50, 'pk:200,s:40', 'milch', ''],
    ['Parmesan|Grana Padano|Parmigiano|Hartkäse|Pecorino', 400, 33, 0, 29, 0, 10, 'el:7,tl:3,s:10', 'milch', ''],
    ['Halloumi|Grillkäse', 320, 22, 2, 25, 0, 100, 'pk:225,sch:30', 'milch', ''],
    ['Camembert|Brie|Weichkäse', 300, 20, 0.1, 24, 0, 30, 'st:30,s:30', 'milch', ''],
    ['Handkäs|Handkäse|Mainzer Käse|Harzer|Harzer Käse|Quargel', 130, 30, 0, 0.5, 0, 50, 'st:50,x:50,s:50', 'milch', ''],
    ['Kochkäse|Kochkäs', 180, 16, 2, 12, 0, 60, 'po:60,el:20,s:40', 'milch', ''],
    ['Spundekäs|Spundekäse|Obatzda|Obazda|Obatzter', 260, 8, 3, 24, 0, 80, 'po:80,el:20,s:40', 'milch', ''],
    ['Babybel|Mini Babybel|Minikäse', 315, 22, 0, 25, 0, 20, 'st:20,x:20', 'milch', ''],
    ['Handkäs mit Musik|Handkäse mit Musik', 170, 22, 3, 7, 0.5, 150, 'po:150,x:150', 'milch', 'z'],
    ['Butter|Margarine|Streichfett|Pflanzenmargarine|Kräuterbutter', 740, 0.7, 0.6, 82, 0, 10, 'tl:5,el:12,s:10', 'fett', ''],
    ['Sahne|Schlagsahne|Rahm|süße Sahne', 292, 2.4, 3.2, 30, 0, 30, 'el:15,s:30,h:15', 'milch', 'd'],
    ['saure Sahne|Sauerrahm|Schmand|Crème fraîche|Creme fraiche|Schmant', 180, 2.8, 3.5, 17, 0, 30, 'el:15,s:30', 'milch', ''],
    ['Kefir|Ayran|Buttermilch|Dickmilch|Sauermilch', 50, 3.4, 4, 2, 0, 250, 'gl:250,be:250,x:250', 'milch', 'd'],
    ['Proteinpudding|High-Protein-Pudding|Eiweißpudding|Protein-Pudding', 75, 10, 6, 1.3, 0, 200, 'be:200,x:200', 'protein', ''],
    ['Pudding|Vanillepudding|Schokopudding|Schokoladenpudding|Grießpudding|Grießbrei|Milchreis', 115, 3.3, 18, 3, 0.3, 150, 'be:125,x:150,s:100', 'suess', ''],
    ['Götterspeise|Wackelpudding|Wackelpeter', 70, 1.5, 16, 0, 0, 150, 'be:125,po:150', 'suess', ''],
    ['Rote Grütze|Grütze', 110, 0.8, 26, 0.3, 1.5, 150, 'be:150,po:150,s:100', 'suess', ''],
    ['Dessert|Nachtisch|Nachspeise|Süßspeise|Mehlspeise', 200, 4, 28, 8, 0.5, 150, 'po:150,be:150', 'suess', ''],
    ['Proteinmilch|Proteindrink|High-Protein-Drink|Protein-Drink|Eiweißdrink', 60, 8, 4, 1, 0, 330, 'fl:330,gl:250,x:330', 'protein', 'd'],
    ['Mascarpone', 430, 4.5, 4, 44, 0, 30, 'el:20,be:250,s:30', 'milch', ''],
    ['Ricotta', 150, 9, 3.5, 11, 0, 50, 'el:20,be:250,s:50', 'milch', ''],
    ['Burrata', 300, 15, 1, 26, 0, 125, 'st:125,x:125,s:60', 'milch', ''],

    // Bread and cereals
    ['Brot|Mischbrot|Bauernbrot|Roggenbrot|Graubrot|Sauerteigbrot|Roggenmischbrot|Weizenmischbrot|Landbrot|Kastenbrot|Weißbrot|Ciabatta|Fladenbrot|Brotscheibe|Brotscheiben', 225, 6.5, 44, 1.5, 5, 45, 'sch:45,st:45,s:45', 'brot', ''],
    ['Vollkornbrot|Schwarzbrot|Pumpernickel|Dinkelvollkornbrot|Roggenvollkornbrot|Körnerbrot|Mehrkornbrot|Dinkelbrot', 215, 7, 38, 1.5, 8, 45, 'sch:45,st:45,s:45', 'brot', ''],
    ['Proteinbrot|Eiweißbrot|Low-Carb-Brot|Eiweiß-Brot', 260, 24, 6, 14, 12, 40, 'sch:40,st:40,s:40', 'protein', ''],
    ['Knoblauchbrot|Kräuterbaguette|Knoblauchbaguette|Kräuterbutterbaguette', 330, 7.5, 40, 15, 2.5, 60, 'st:60,sch:30,s:60', 'brot', 'z'],
    ['Toast|Toastbrot|Toastscheibe|Toastscheiben|Weizentoast|Sandwichtoast|Buttertoast', 265, 8, 48, 3.6, 3, 25, 'sch:25,st:25,s:50', 'brot', ''],
    ['Vollkorntoast|Dinkeltoast|Vollkorn-Toast', 250, 9, 42, 4, 6, 25, 'sch:25,st:25,s:50', 'brot', ''],
    ['Brötchen|Semmel|Semmeln|Schrippe|Schrippen|Weck|Wecken|Weckle|Weckchen|Weckche|Wasserweck|Weizenbrötchen|Kaiserbrötchen|Aufbackbrötchen|Baguettebrötchen|Rundstück', 270, 9, 52, 1.9, 3, 60, 'st:60,s:60', 'brot', ''],
    ['Vollkornbrötchen|Körnerbrötchen|Dinkelbrötchen|Mehrkornbrötchen|Roggenbrötchen|Kürbiskernbrötchen|Sonnenblumenbrötchen|Vollkornsemmel', 260, 10, 43, 4.5, 6.5, 70, 'st:70,s:70', 'brot', ''],
    ['Brezel|Breze|Brezn|Brezeln|Laugenbrezel|Laugenbrötchen|Laugenstange|Laugengebäck|Laugenecke', 270, 8, 54, 2, 2.5, 80, 'st:80,s:80', 'brot', ''],
    ['Croissant|Croissants|Hörnchen|Butterhörnchen|Buttercroissant|Schokocroissant|Franzbrötchen', 410, 8, 45, 21, 2, 60, 'st:60', 'suess', ''],
    ['Hefezopf|Brioche|Rosinenzopf|Osterzopf|Milchbrötchen|Hefegebäck', 340, 8, 52, 10.5, 2, 50, 'sch:50,st:50,x:50', 'brot', ''],
    ['Knäckebrot|Knäcke|Knäckebrotscheibe', 340, 10, 65, 1.6, 15, 10, 'sch:10,st:10,s:20', 'brot', ''],
    ['Haferflocken|Haferkleie|zarte Haferflocken|kernige Haferflocken|Dinkelflocken|Oats', 370, 13.5, 59, 7, 10, 50, 'el:10,ta:80,po:50,s:40', 'getreide', ''],
    ['Porridge|Haferbrei|Overnight Oats|Oatmeal|Porridge mit Milch', 125, 5.3, 15.5, 4.2, 2, 300, 'po:300,x:300', 'getreide', ''],
    ['Müsli|Früchtemüsli|Basismüsli|Nussmüsli|Schokomüsli', 360, 10, 60, 7, 8, 60, 'el:10,po:60,ta:80,s:40', 'getreide', ''],
    ['Granola|Knuspermüsli|Crunchy|Knusper-Müsli|Crunchy Müsli', 450, 9, 62, 18, 6, 50, 'el:10,po:50,s:40', 'getreide', ''],
    ['Cornflakes|Frühstücksflocken|Flakes|Cerealien', 375, 7.5, 84, 0.9, 3, 40, 'po:40,s:30', 'getreide', ''],
    ['Reis|gekochter Reis|Basmatireis|Jasminreis|Langkornreis|Parboiled Reis|Duftreis|Reis gekocht|Sushireis', 130, 2.7, 28, 0.3, 0.4, 180, 'po:180,ta:150,el:20,s:180', 'getreide', ''],
    ['Vollkornreis|Naturreis|brauner Reis|Wildreis', 123, 2.7, 25.6, 1, 1.8, 180, 'po:180,ta:150,s:180', 'getreide', ''],
    ['Reis roh|Reis ungekocht|Reis trocken|roher Reis|ungekochter Reis', 350, 7, 78, 0.6, 1.4, 70, '', 'getreide', ''],
    ['Nudeln|Pasta|Spaghetti|Penne|Fusilli|Tagliatelle|Makkaroni|Maccaroni|Farfalle|Rigatoni|Spätzle|Bandnudeln|Hörnchennudeln|Linguine|Nudeln gekocht', 150, 5.5, 30, 0.9, 1.8, 220, 'po:220,ta:140,s:220', 'getreide', ''],
    ['Tortellini|Ravioli|Tortelloni|Gefüllte Nudeln', 200, 8, 30, 5, 2, 250, 'po:250,s:250', 'getreide', ''],
    ['Gnocchi|Schupfnudeln', 135, 3.5, 28, 0.8, 1.5, 250, 'po:250,s:200', 'getreide', ''],
    ['Vollkornnudeln|Vollkornpasta|Vollkornspaghetti|Dinkelnudeln', 140, 5.8, 26, 1.1, 4, 220, 'po:220,s:220', 'getreide', ''],
    ['Vollkornnudeln roh|Vollkornnudeln ungekocht|Vollkornnudeln trocken|Vollkornpasta roh', 345, 14, 64, 2.5, 8, 100, '', 'getreide', ''],
    ['Haferflocken roh', 370, 13.5, 59, 7, 10, 50, 'el:10,ta:80,po:50,s:40', 'getreide', ''],
    ['Nudeln roh|Nudeln ungekocht|Nudeln trocken|Pasta roh|Pasta ungekocht|Spaghetti roh|Spaghetti ungekocht|rohe Nudeln|ungekochte Nudeln', 355, 12.5, 70, 1.5, 3, 100, '', 'getreide', ''],
    ['Kartoffel|Kartoffeln|Pellkartoffeln|Salzkartoffeln|Ofenkartoffel|Ofenkartoffeln|Backkartoffel|Pellkartoffel|Salzkartoffel|Erdäpfel', 72, 2, 15, 0.1, 2, 200, 'st:80,po:200,s:200', 'getreide', ''],
    ['Bratkartoffeln|Röstkartoffeln|Rosmarinkartoffeln|Kartoffelecken|Wedges|Kroketten', 150, 2.5, 18, 7.5, 2, 200, 'po:200,s:200', 'getreide', ''],
    ['Kartoffelpüree|Kartoffelbrei|Püree|Kartoffelstampf|Stampfkartoffeln', 90, 2, 12, 4, 1.2, 200, 'po:200,s:200', 'getreide', ''],
    ['Pommes|Pommes frites|Fritten|Ofenpommes|Fries|Süßkartoffelpommes', 290, 3.4, 36, 15, 3, 150, 'po:150,s:150', 'getreide', ''],
    ['Rösti|Reibekuchen|Kartoffelpuffer|Reiberdatschi|Hash Browns', 210, 3, 22, 12, 2.5, 150, 'st:70,s:140', 'getreide', ''],
    ['Süßkartoffel|Süßkartoffeln|Batate', 86, 1.6, 20, 0.1, 3, 200, 'st:250,po:200,s:200', 'getreide', ''],
    ['Couscous|Bulgur|Hirse|Graupen', 112, 3.8, 23, 0.4, 2, 180, 'po:180,s:180', 'getreide', ''],
    ['Polenta', 85, 2, 18, 0.5, 1, 200, 'po:200,s:150', 'getreide', ''],
    ['Quinoa|Amaranth|Buchweizen', 120, 4.4, 21, 1.9, 2.8, 180, 'po:180,s:180', 'getreide', ''],
    ['Wrap|Wraps|Tortilla|Tortillas|Tortillafladen|Weizentortilla', 300, 8, 50, 7, 3, 60, 'st:60,s:60', 'brot', ''],
    ['Pizza|Pizza Salami|Salamipizza|Tiefkühlpizza|Pizza Schinken|Pizza Funghi|Pizza Tonno|Pizza Hawaii|Calzone', 255, 11, 29, 10.5, 2, 400, 'x:400,st:100,po:400', 'gericht', ''],
    ['Pizza Margherita|Margherita|Gemüsepizza|Pizza vegetarisch', 240, 10, 30, 9, 2, 400, 'x:400,st:100,po:400', 'gericht', ''],
    ['Pfannkuchen|Eierkuchen|Pancakes|Pancake|Crêpes|Crepes|Crêpe|Crepe|Palatschinken', 220, 7, 28, 9, 1, 80, 'st:80', 'suess', ''],
    ['Bagel|Bagels', 260, 10, 50, 1.6, 2.5, 90, 'st:90,s:90', 'brot', ''],
    ['Flammkuchen|Tarte flambée', 250, 8, 27, 12, 1.5, 350, 'x:350,st:80', 'gericht', 'z'],
    ['Toast Hawaii|Croque|Croque Monsieur|überbackener Toast', 230, 12, 20, 11, 1.5, 150, 'st:150', 'gericht', ''],
    ['Pita|Pitabrot|Naan|Naanbrot|Chapati|Roti', 270, 9, 54, 1.5, 2.5, 70, 'st:70,x:70,s:70', 'brot', ''],
    ['Zwieback', 400, 10, 75, 5, 4, 20, 'st:10,x:10', 'brot', ''],
    ['Semmelknödel|Serviettenknödel|Brezenknödel|Brezelknödel|Speckknödel', 170, 6, 27, 4, 1.5, 200, 'st:100,x:100', 'getreide', ''],
    ['Kartoffelknödel|Kartoffelklöße|Klöße|Kloß|Knödel|Thüringer Klöße|Grüne Klöße', 115, 2.5, 24, 0.5, 2, 200, 'st:100,x:100', 'getreide', ''],
    ['Pommes rot weiß|Pommes Schranke|Pommes Mayo Ketchup|Pommes Mayo|Pommes mit Mayo', 305, 3, 32.3, 18.3, 2.5, 180, 'po:180,x:180', 'getreide', ''],
    ['Chia-Pudding|Chiapudding', 130, 5, 10, 7, 6, 200, 'po:200,be:150,x:200', 'getreide', ''],
    ['Bircher Müsli|Birchermüsli', 120, 4, 18, 3.5, 2.5, 250, 'po:250,be:200,x:250', 'getreide', ''],

    // Meat
    ['Hähnchenbrust|Hähnchenbrustfilet|Hähnchenbrustfilets|Hühnerbrust|Hähnchenfilet|Hühnchenbrust|Hähnchen|Huhn|Hühnchen|Hühnerfleisch|Chicken|Hähnchengeschnetzeltes|Hähnchenstreifen|Pouletbrust', 110, 23.5, 0, 1.5, 0, 150, 'st:150,po:150,s:120', 'fleisch', ''],
    ['gebratene Hähnchenbrust|Hähnchenbrust gebraten|gegrillte Hähnchenbrust|Hähnchenbrust gegrillt|Hähnchen gebraten|gebratenes Hähnchen|Hähnchen gegrillt|gegrilltes Hähnchen', 165, 31, 0, 3.6, 0, 120, 'st:120,po:120,s:100', 'fleisch', ''],
    ['Hähnchenschenkel|Hähnchenkeule|Hähnchenkeulen|Hühnerkeule|Hähnchenflügel|Chicken Wings|Wings|Chickenwings|Grillhähnchen|Brathähnchen|Hendl', 215, 21, 0, 14.5, 0, 150, 'st:150,po:200', 'fleisch', ''],
    ['halbes Hähnchen|halbes Grillhähnchen|halbes Brathähnchen|halbes Hendl|halber Gockel', 200, 24, 0, 11.5, 0, 350, 'st:350,po:350,x:350', 'fleisch', ''],
    ['Hähnchenspieß|Hähnchenspieße|Putenspieß|Putenspieße|Chicken Satay|Hähnchen Satay|Satay|Yakitori', 150, 25, 2, 5, 0, 200, 'st:100,x:100,po:200', 'fleisch', ''],
    ['Souvlaki|Fleischspieß|Fleischspieße|Grillspieß|Grillspieße|Schweinespieß|Schweinespieße', 210, 25, 1, 12, 0, 200, 'st:100,x:100,po:200', 'fleisch', ''],
    ['Chicken Nuggets|Nuggets|Hähnchen-Nuggets|Hähnchennuggets', 250, 15, 15, 14, 1, 120, 'st:18', 'fleisch', ''],
    ['Pute|Puten|Putenbrust|Putenfleisch|Putenschnitzel|Putenbrustfilet|Truthahn|Putengeschnetzeltes|Putensteak|Putenstreifen', 105, 24, 0, 1, 0, 150, 'st:150,po:150,s:120', 'fleisch', ''],
    ['Rinderhack|Rinderhackfleisch|Tatar|Beefsteakhack', 215, 20, 0, 15, 0, 125, 'pk:400,po:125', 'fleisch', ''],
    ['Hackfleisch|Hack|Gehacktes|gemischtes Hack|Hackfleisch gemischt|gemischtes Hackfleisch|Mett|Hackepeter|Schweinemett', 260, 18, 0, 21, 0, 125, 'pk:400,po:125', 'fleisch', ''],
    ['Steak|Rindersteak|Rumpsteak|Hüftsteak|Entrecôte|Entrecote|Rinderfilet|Rindfleisch|Filetsteak|Roastbeef|Flanksteak|Ribeye|Rib-Eye|Beef', 155, 25, 0, 6, 0, 200, 'st:200,po:200', 'fleisch', ''],
    ['Schweinefilet|Schweinelende|Schweinefleisch|Schwein|Schweinemedaillons|Lende', 110, 21.5, 0, 2.5, 0, 150, 'po:150', 'fleisch', ''],
    ['Kotelett|Schweinekotelett|Nackensteak|Schweinenacken|Grillsteak|Schweinesteak|Rippchen', 220, 18, 0, 16.5, 0, 180, 'st:180,po:180', 'fleisch', ''],
    ['Schweinebauch|Pork Belly|Wammerl|Bauchfleisch', 350, 18, 0, 31, 0, 200, 'po:200,st:150,sch:50', 'fleisch', ''],
    ['Spareribs|Ribs|Schälrippchen|Schälrippe', 290, 20, 5, 21, 0, 250, 'po:250,x:250', 'fleisch', ''],
    ['Schnitzel|Wiener Schnitzel|Schweineschnitzel|paniertes Schnitzel|Jägerschnitzel|Rahmschnitzel|Cordon bleu|Schnitzel paniert|Schnitzel Wiener Art', 230, 18, 11, 13, 0.5, 180, 'st:180,po:180', 'fleisch', ''],
    ['Braten|Schweinebraten|Rinderbraten|Sauerbraten|Krustenbraten|Rollbraten|Kasseler|Rinderroulade|Roulade|Rouladen|Spanferkel', 200, 25, 1, 11, 0, 150, 'sch:60,po:150', 'fleisch', ''],
    ['Bratwurst|Grillwurst|Rostbratwurst|Thüringer|Bratwürste|Grillwürstchen|Rote Wurst|Weißwurst|Weißwürste', 300, 13, 0.5, 27, 0, 100, 'st:100,po:100', 'fleisch', ''],
    ['Nürnberger|Nürnberger Würstchen|Nürnberger Rostbratwürstchen|Rostbratwürstchen', 300, 13, 0.5, 27, 0, 75, 'st:25', 'fleisch', ''],
    ['Würstchen|Wiener|Wiener Würstchen|Frankfurter|Frankfurter Würstchen|Bockwurst|Würstel|Wienerle|Geflügelwürstchen|Wurst|Würste', 270, 13, 1, 24, 0, 100, 'st:50,po:100', 'fleisch', ''],
    ['Currywurst', 230, 10, 8, 18, 0.5, 200, 'st:200,po:200', 'gericht', ''],
    ['Currywurst mit Pommes|Currywurst Pommes|Currywurst mit Fritten', 255, 7, 23, 15, 2, 400, 'po:400,x:400', 'gericht', ''],
    ['Salami|Salamischeiben|Chorizo|Pfefferbeißer|Mettwurst|Cervelatwurst|Landjäger|Kabanossi', 380, 22, 1, 32, 0, 30, 'sch:10,st:10,s:20', 'fleisch', ''],
    ['Fleischwurst|Lyoner|Ringwurst|Gelbwurst|Mortadella', 285, 12.5, 0.5, 26, 0, 100, 'sch:20,st:100,po:100,s:50', 'fleisch', ''],
    ['Corned Beef|Cornedbeef', 160, 24, 0.5, 7, 0, 80, 'sch:20,po:80,s:40', 'fleisch', ''],
    ['Kochschinken|Schinken|Hinterschinken|gekochter Schinken|Formschinken|Schinkenwürfel', 115, 20, 1, 3.5, 0, 40, 'sch:20,st:20,s:30', 'fleisch', ''],
    ['Rohschinken|Schwarzwälder Schinken|Serrano|Serranoschinken|Parmaschinken|Katenschinken|Lachsschinken', 230, 26, 0.5, 14, 0, 30, 'sch:15,st:15,s:20', 'fleisch', ''],
    ['Bacon|Frühstücksspeck|Speck|Speckwürfel', 420, 15, 1, 40, 0, 30, 'sch:10,st:10,s:20', 'fleisch', ''],
    ['Putenbrustaufschnitt|Putenaufschnitt|Putenbrust Aufschnitt|Geflügelaufschnitt|Hähnchenbrustaufschnitt|Putenschinken|Geflügelwurst|Hähnchenaufschnitt', 105, 21, 1.5, 1.5, 0, 40, 'sch:20,st:20,s:30', 'fleisch', ''],
    ['Leberwurst|Teewurst|Streichwurst', 330, 15, 1, 29, 0, 25, 'el:20,s:20', 'fleisch', ''],
    ['Leberkäse|Fleischkäse|Leberkäs', 290, 12, 1, 27, 0, 120, 'sch:120,st:120,x:120', 'fleisch', ''],
    ['Frikadelle|Frikadellen|Bulette|Buletten|Fleischpflanzerl|Fleischküchle|Hacksteak|Fleischlaberl|Bifteki', 240, 15, 8, 16, 0.5, 90, 'st:90,x:90', 'fleisch', ''],
    ['Köttbullar|Hackbällchen|Fleischbällchen', 240, 15, 8, 16, 0.5, 150, 'st:15,x:15', 'fleisch', ''],
    ['Döner|Döner Kebab|Dönertasche|Kebab|Dürüm|Dürüm Döner|Yufka|Shawarma|Schawarma', 215, 11, 20, 10, 1.5, 400, 'x:400,st:400', 'gericht', 'z'],
    ['Dönerbox|Döner Box|Dönerteller|Döner Teller', 230, 12, 18, 12, 2, 450, 'po:450,x:450', 'gericht', 'z'],
    ['Burger|Hamburger|Cheeseburger|Rindfleischburger|Beefburger|Chickenburger|Pulled Pork Burger', 250, 13, 24, 11, 1.5, 200, 'x:200,st:200', 'gericht', ''],
    ['Gyros|Gyrosteller|Gyros Teller', 230, 16, 6, 16, 1, 250, 'po:250', 'fleisch', 'z'],
    ['Leber|Rinderleber|Hähnchenleber', 135, 20, 4, 4, 0, 150, '', 'fleisch', ''],
    ['Gans|Gänsebraten|Gänsekeule|Gänsebrust|Martinsgans|Weihnachtsgans|Gänseklein|Ente|Entenbraten|Entenkeule|Entenbrust|Pekingente|knusprige Ente', 290, 24, 0, 21.5, 0, 200, 'po:200,st:250,x:250', 'fleisch', ''],
    ['Wild|Wildbraten|Hirsch|Hirschbraten|Hirschrücken|Hirschkeule|Reh|Rehbraten|Rehrücken|Rehkeule|Wildschwein|Wildschweinbraten', 140, 23, 1, 5, 0, 150, 'po:150,sch:60', 'fleisch', ''],
    ['Schweinshaxe|Haxe|Hachse|Schweinshachse|Schweinehaxe|Eisbein|Grillhaxe', 250, 22, 0, 18, 0, 350, 'po:350,st:350,x:350', 'fleisch', ''],
    ['Pulled Pork', 200, 20, 8, 10, 0.5, 150, 'po:150,s:100', 'fleisch', ''],
    ['Cevapcici|Ćevapčići|Cevapi|Köfte|Kofta|Adana|Adana Kebap|Hackfleischspieß|Hackspieß|Hackfleischröllchen', 250, 17, 2, 19.5, 0, 200, 'po:200,st:25,x:25', 'fleisch', ''],
    ['Pinkel|Pinkelwurst|Kohlwurst', 330, 12, 8, 28, 1, 120, 'st:120,x:120,s:120', 'fleisch', ''],

    // Fish
    ['Lachs|Lachsfilet|Wildlachs|Lachssteak|Lachsforelle', 200, 20, 0, 13, 0, 125, 'st:125,po:125,s:100', 'fisch', ''],
    ['Räucherlachs|geräucherter Lachs|Graved Lachs|Gravlax|Stremellachs|Lachs geräuchert', 180, 21, 0, 10.5, 0, 50, 'sch:20,pk:100,s:40', 'fisch', ''],
    ['Thunfisch|Thun|Tunfisch|Thunfisch im eigenen Saft|Thunfisch natur|Thunfischsteak', 110, 25, 0, 1, 0, 140, 'do:140,s:70', 'fisch', ''],
    ['Thunfisch in Öl', 200, 24, 0, 11.5, 0, 140, 'do:140,s:70', 'fisch', ''],
    ['Forelle|Saibling|Forellenfilet|Räucherforelle|Regenbogenforelle|Zander|Barsch|Karpfen', 110, 20, 0, 3.5, 0, 125, 'st:125,po:125', 'fisch', ''],
    ['Fisch|Fischfilet|Kabeljau|Dorsch|Seelachs|Alaska-Seelachs|Pangasius|Rotbarsch|Scholle|Seehecht|Schellfisch|Tilapia|weißer Fisch|Heilbutt|Dorade|Wolfsbarsch|Loup de Mer|Seebarsch|Branzino', 85, 18.5, 0, 1, 0, 150, 'st:150,po:150', 'fisch', ''],
    ['Backfisch|Fisch paniert|Schlemmerfilet|Fischfilet paniert', 210, 13, 15, 11, 1, 150, 'st:150', 'fisch', ''],
    ['Fischstäbchen', 200, 12, 18, 9, 1, 150, 'st:30,x:30', 'fisch', ''],
    ['Garnelen|Shrimps|Shrimp|Krabben|Scampi|Gambas|Crevetten|Nordseekrabben|Riesengarnelen|Prawns', 85, 19, 0.5, 1, 0, 100, 'st:15,po:100,s:80', 'fisch', ''],
    ['Matjes|Hering|Bismarckhering|Brathering|Rollmops|Heringsfilet|Matjesfilet|Heringe', 250, 16, 1, 20, 0, 75, 'st:60,x:60', 'fisch', ''],
    ['Sardinen|Ölsardinen|Sardellen|Anchovis', 220, 24, 0, 14, 0, 90, 'do:90', 'fisch', ''],
    ['Makrele|Räuchermakrele|Makrelenfilet|Bückling|Sprotten', 230, 19, 0, 17, 0, 100, 'st:100', 'fisch', ''],
    ['Tintenfisch|Calamari|Kalamari|Tintenfischringe|Oktopus', 150, 15, 8, 6, 0.3, 150, '', 'fisch', ''],
    ['Sushi|Maki|Makis|Nigiri|Nigiris|Inside Out|California Roll|Sushirolle|Sushirollen', 150, 5.5, 28, 1.8, 0.8, 200, 'st:25,x:25,po:200', 'gericht', ''],
    ['Muscheln|Miesmuscheln|Venusmuscheln|Jakobsmuscheln|Vongole|Austern', 120, 18, 4, 3.5, 0, 150, 'po:150,x:150', 'fisch', ''],

    // Plant protein, nuts, seeds
    ['Tofu|Tofu natur|Naturtofu|Seidentofu', 122, 13, 1.5, 7, 1, 200, 'pk:200,po:150,s:100', 'pflanze', ''],
    ['Räuchertofu|geräucherter Tofu|Tofu geräuchert|Kräutertofu', 150, 16, 1.5, 9, 1, 100, 'pk:200,po:100,s:80', 'pflanze', ''],
    ['Tempeh', 190, 19, 9, 11, 5, 100, 'pk:200', 'pflanze', ''],
    ['Seitan|Weizeneiweiß', 150, 25, 6, 2, 1, 100, 'pk:200', 'pflanze', ''],
    ['Sojaschnetzel|Sojagranulat|Sojahack|Soja-Hack', 340, 50, 13, 1, 15, 40, '', 'pflanze', ''],
    ['Veggie Burger|Veggieburger|vegetarischer Burger|veganer Burger|Gemüsebratling|Bratling|Gemüsefrikadelle', 220, 15, 12, 12, 4, 100, 'st:100,x:100', 'pflanze', ''],
    ['Veggie-Schnitzel|vegetarisches Schnitzel|veganes Schnitzel|Sojaschnitzel|Seitanschnitzel|Gemüseschnitzel', 220, 15, 16, 10, 4, 120, 'st:120,x:120', 'pflanze', ''],
    ['vegane Würstchen|vegetarische Würstchen|Tofuwürstchen|Veggie-Würstchen', 230, 18, 6, 15, 2, 100, 'st:50,x:50', 'pflanze', ''],
    ['Linsen|rote Linsen|Berglinsen|Tellerlinsen|Belugalinsen|Linsen gekocht|gekochte Linsen|Dosenlinsen', 116, 9, 17, 0.4, 8, 200, 'do:265,po:200,s:150', 'pflanze', ''],
    ['Linsen roh|Linsen trocken|rohe Linsen|getrocknete Linsen', 340, 24, 48, 1.5, 17, 70, '', 'pflanze', ''],
    ['Kichererbsen|Kichererbsen gekocht', 140, 8, 20, 2.5, 7, 150, 'do:240,po:150,s:100', 'pflanze', ''],
    ['Bohnen|Kidneybohnen|rote Bohnen|weiße Bohnen|schwarze Bohnen|Wachtelbohnen|Borlottibohnen|Kidney-Bohnen|Bohnenmix', 110, 7.5, 15, 0.5, 7, 150, 'do:250,po:150,s:100', 'pflanze', ''],
    ['Baked Beans|Bohnen in Tomatensoße|Bohnen in Tomatensauce', 90, 5, 13, 0.5, 5, 200, 'do:400', 'pflanze', ''],
    ['Edamame|Sojabohnen', 120, 11, 9, 5, 5, 100, 'po:100', 'pflanze', ''],
    ['Falafel|Falafeln|Falafelbällchen', 330, 13, 31, 18, 5, 100, 'st:20,x:20', 'pflanze', ''],
    ['Falafel-Wrap|Falafeltasche|Falafel im Brot|Falafel Dürüm', 230, 7.5, 30, 9, 4, 350, 'st:350,x:350', 'gericht', 'z'],
    ['Hummus|Humus|Hommus', 260, 7, 14, 19, 6, 50, 'el:20,pk:200,s:40', 'pflanze', 'z'],
    ['Erdnussbutter|Erdnussmus|Peanut Butter|Erdnusscreme|Erdnuss-Butter', 600, 25, 13, 49, 7, 20, 'el:16,tl:6,s:15', 'nuss', ''],
    ['Mandelmus|Cashewmus|Nussmus|Haselnussmus|Tahin|Tahini|Sesammus', 620, 22, 10, 54, 9, 20, 'el:16,tl:6,s:15', 'nuss', ''],
    ['Mandeln|Mandel|Mandelkerne', 600, 21, 6, 52, 12, 25, 'st:1.2,x:1.2,hv:25,el:10', 'nuss', ''],
    ['Walnüsse|Walnuss|Walnusskerne|Walnusshälften', 670, 15, 7, 65, 6.5, 25, 'st:5,x:5,hv:25,el:8', 'nuss', ''],
    ['Cashews|Cashewkerne|Cashewnüsse|Cashew|Cashewnuss', 585, 18, 30, 44, 3, 25, 'st:1.5,x:1.5,hv:25', 'nuss', ''],
    ['Erdnüsse|Erdnuss|Erdnusskerne|geröstete Erdnüsse', 600, 25, 9, 49, 8, 25, 'st:1,x:1,hv:25', 'nuss', ''],
    ['Nüsse|Nuss|Nussmischung|Nusskerne|Haselnüsse|Haselnuss|Haselnusskerne|Pistazien|Pekannüsse|Macadamia|Paranüsse', 640, 16, 9, 60, 8, 30, 'hv:25,el:10', 'nuss', ''],
    ['Studentenfutter|Trail Mix|Nuss-Frucht-Mischung', 480, 13, 38, 30, 6, 30, 'hv:30', 'nuss', ''],
    ['Kürbiskerne|Kürbiskern', 570, 30, 7, 48, 6, 20, 'el:10,hv:25', 'nuss', ''],
    ['Chiasamen|Chia|Chia-Samen', 490, 17, 8, 31, 34, 15, 'el:12,tl:5', 'nuss', ''],
    ['Leinsamen|Leinsaat|geschroteter Leinsamen|Leinsamen geschrotet', 520, 18, 2, 42, 27, 10, 'el:10,tl:4', 'nuss', ''],
    ['Sonnenblumenkerne|Sesam|Sesamsamen|Hanfsamen|Pinienkerne', 580, 21, 12, 51, 9, 20, 'el:10', 'nuss', ''],
    ['gebrannte Mandeln|gebrannte Nüsse|kandierte Mandeln|gebrannte Erdnüsse|gebrannte Cashews', 500, 13, 45, 30, 6, 100, 'pk:100,hv:30,x:100', 'nuss', ''],
    ['Maronen|Maroni|Esskastanien|Edelkastanien|Kastanien|heiße Maronen', 210, 3, 44, 2, 5, 150, 'pk:150,hv:40,x:10', 'nuss', ''],

    // Protein products
    ['Proteinpulver|Eiweißpulver|Whey|Whey Protein|Wheyprotein|Molkenprotein|Casein|Erbsenprotein|Sojaprotein|veganes Proteinpulver', 380, 78, 6, 5, 0, 30, 'ms:30,el:10,x:30', 'protein', ''],
    ['Proteinshake|Eiweißshake|Shake|Protein-Shake|Proteinshake mit Wasser|Eiweißshake mit Wasser|Shake mit Wasser|Whey Shake|Wheyshake', 35, 7.1, 0.6, 0.5, 0, 330, 'gl:330,be:330,fl:330,x:330', 'protein', 'd'],
    ['Proteinshake mit Milch|Eiweißshake mit Milch|Shake mit Milch|Protein-Shake mit Milch', 77, 10.2, 5, 1.8, 0, 330, 'gl:330,be:330,fl:330,x:330', 'protein', 'd'],
    ['Proteinriegel|Eiweißriegel|Protein Bar|Proteinbar|Protein-Riegel', 350, 32, 28, 11, 6, 60, 'st:60,ri:60,x:60', 'protein', ''],
    ['Protein Pancakes|Proteinpancakes|Protein Pfannkuchen|Proteinpfannkuchen|Eiweißpfannkuchen', 190, 18, 18, 5, 2, 150, 'st:50,x:50,po:150', 'protein', ''],
    ['Proteinkeks|Proteinkekse|Protein Cookie|Proteincookie|Proteinwaffel|Proteinwaffeln', 400, 30, 40, 13, 5, 50, 'st:50,x:50', 'protein', ''],
    ['Proteinchips|Protein-Chips', 400, 40, 35, 10, 5, 30, 'pk:30', 'protein', ''],
    ['Beef Jerky|Jerky|Trockenfleisch|Biltong|Bündnerfleisch', 280, 40, 10, 8, 0.5, 30, 'pk:50,x:30', 'protein', ''],
    ['Protein-Eis|Proteineis|High-Protein-Eis|Eiweißeis', 100, 10, 12, 1.5, 2, 125, 'ku:60,be:250,x:125', 'protein', ''],
    ['Proteinbrötchen|Eiweißbrötchen|Low-Carb-Brötchen|Protein-Brötchen', 270, 25, 12, 12, 8, 75, 'st:75,x:75,s:75', 'protein', ''],

    // Vegetables
    ['Brokkoli|Broccoli|Brokkoliröschen', 34, 3, 3, 0.4, 3, 150, 'po:150,s:150', 'gem', ''],
    ['Blumenkohl|Romanesco', 23, 2, 2.5, 0.3, 2.5, 150, 'po:150,s:150', 'gem', ''],
    ['Spinat|Blattspinat|Babyspinat|Spinatblätter|Mangold', 23, 2.9, 0.6, 0.4, 2.2, 150, 'po:150,hv:30,s:100', 'gem', ''],
    ['Rahmspinat|Cremespinat|Spinat mit Sahne', 60, 3, 3, 4, 2, 150, 'po:150,s:150', 'gem', ''],
    ['Tomate|Tomaten|Rispentomate|Rispentomaten|Strauchtomate|Strauchtomaten|Fleischtomate', 18, 0.9, 2.6, 0.2, 1.2, 100, 'st:100,x:100,s:60', 'gem', ''],
    ['Cherrytomaten|Kirschtomaten|Cocktailtomaten|Datteltomaten|Cherrytomate|Kirschtomate|Cocktailtomate|Snacktomaten|Minitomaten', 20, 1, 2.9, 0.3, 1.3, 100, 'st:15,x:15,hv:60,s:60', 'gem', ''],
    ['Gurke|Gurken|Salatgurke|Salatgurken|Schlangengurke', 12, 0.6, 1.8, 0.2, 0.5, 100, 'x:400,st:50,sch:8,s:60', 'gem', ''],
    ['Essiggurke|Essiggurken|Gewürzgurke|Gewürzgurken|saure Gurke|saure Gurken|Cornichons', 25, 0.5, 4.5, 0.2, 1, 50, 'st:40,x:40', 'gem', ''],
    ['Paprika|Paprikaschote|Paprikaschoten|Spitzpaprika|rote Paprika|gelbe Paprika|grüne Paprika', 30, 1, 5, 0.4, 3.5, 150, 'st:150,x:150,s:75', 'gem', ''],
    ['Karotte|Karotten|Möhre|Möhren|Mohrrübe|Mohrrüben|gelbe Rübe|gelbe Rüben|Rüebli|Babykarotten', 36, 0.9, 6.7, 0.2, 3, 100, 'st:80,x:80,s:75', 'gem', ''],
    ['Zucchini|Zucchinis|Zucchino', 19, 1.6, 2.2, 0.4, 1.1, 150, 'st:250,x:250,s:100', 'gem', ''],
    ['Salat|gemischter Salat|Beilagensalat|Salatteller|Salat mit Dressing', 50, 1.3, 3, 3.5, 1.5, 150, 'po:150,s:100', 'gem', ''],
    ['Rucola|Rauke|Feldsalat|Eisbergsalat|Kopfsalat|Blattsalat|Salatblätter|Römersalat|Romanasalat|Pflücksalat|Eichblattsalat|Lollo Rosso|Chicorée|Radicchio', 16, 1.4, 1.6, 0.3, 1.5, 50, 'hv:25,s:40', 'gem', ''],
    ['Champignons|Pilze|Champignon|Steinpilze|Pfifferlinge|Austernpilze|Kräuterseitlinge|Shiitake', 22, 3, 0.6, 0.3, 2, 100, 'po:100,s:75', 'gem', ''],
    ['Zwiebel|Zwiebeln|rote Zwiebel|rote Zwiebeln|Frühlingszwiebel|Frühlingszwiebeln|Lauchzwiebel|Lauchzwiebeln|Schalotte|Schalotten', 30, 1.2, 5, 0.2, 1.8, 50, 'st:80,x:80,s:30', 'gem', 'z'],
    ['Röstzwiebeln', 590, 6, 40, 44, 6, 10, 'el:5,s:10', 'gem', 'z'],
    ['Knoblauch|Knoblauchzehe|Knoblauchzehen|Knofi', 145, 6, 28, 0.1, 2, 3, 'ze:3,st:3,x:3,tl:3', 'gem', 'z'],
    ['Aioli|Knoblauchsoße|Knoblauchsauce|Knoblauchdip|Knoblauchcreme', 600, 1.5, 3, 65, 0.2, 20, 'el:15,s:20', 'fett', 'z'],
    ['Avocado|Avocados|Avocadohälfte', 160, 2, 2, 15, 6.5, 70, 'x:140,st:140,s:50', 'gem', ''],
    ['Mais|Zuckermais|Maiskolben|Maiskörner', 90, 3, 15, 1.4, 3, 75, 'kolben:150,do:140,el:15,s:50', 'gem', ''],
    ['grüne Bohnen|Brechbohnen|Prinzessbohnen|Buschbohnen|Stangenbohnen|Keniabohnen', 28, 2, 4, 0.2, 3, 150, 'po:150,s:100', 'gem', ''],
    ['Erbsen|grüne Erbsen|Tiefkühlerbsen|Zuckerschoten|Kaiserschoten', 80, 5.5, 11, 0.4, 5, 150, 'po:150,s:75', 'gem', ''],
    ['Rosenkohl', 43, 4.5, 3.5, 0.3, 4.4, 150, 'po:150,s:100', 'gem', ''],
    ['Kohlrabi', 25, 2, 3.7, 0.1, 1.5, 150, 'st:250,x:250,s:100', 'gem', ''],
    ['Aubergine|Auberginen|Melanzani', 20, 1.2, 2.5, 0.2, 2.8, 150, 'st:300,x:300,s:100', 'gem', ''],
    ['Rote Bete|Rote Beete|Rote Rübe|Rote Rüben|Randen', 42, 1.5, 8, 0.1, 2.5, 100, 'st:100,s:60', 'gem', ''],
    ['Artischocke|Artischocken|Artischockenherzen', 45, 2.5, 5, 0.2, 5, 100, 'st:100,po:100,s:60', 'gem', ''],
    ['Peperoni|Pfefferoni|Peperoncini|Jalapeños|Jalapenos|Chilischote|Chilischoten', 30, 1.5, 4.5, 0.4, 2.5, 30, 'st:10,x:10,hv:30,s:20', 'gem', ''],
    ['Rhabarber', 15, 0.6, 1.4, 0.1, 3.2, 150, 'po:150,st:100,s:100', 'gem', ''],
    ['Gemüse|Gemüsemix|Mischgemüse|Pfannengemüse|Ofengemüse|Wokgemüse|Kaisergemüse|Gemüsepfanne|Grillgemüse|Ratatouille', 40, 2, 5, 1, 3, 200, 'po:200,s:150', 'gem', ''],
    ['Antipasti|eingelegtes Gemüse', 120, 1.5, 5, 10, 2.5, 100, 'po:100,s:60', 'gem', ''],
    ['Sauerkraut|Kraut', 20, 1.5, 0.8, 0.3, 2.1, 150, 'po:150,s:150', 'gem', ''],
    ['Rotkohl|Blaukraut|Rotkraut|Apfelrotkohl', 60, 1.3, 9, 1.5, 2.5, 150, 'po:150,s:150', 'gem', ''],
    ['Weißkohl|Kohl|Wirsing|Spitzkohl|Grünkohl|Krautsalat|Weißkraut|Spitzkraut', 30, 1.8, 4, 0.3, 2.8, 150, 'po:150,s:100', 'gem', ''],
    ['Spargel|weißer Spargel|grüner Spargel|Spargelstangen', 18, 2, 2, 0.1, 1.5, 250, 'st:25,po:250,s:150', 'gem', ''],
    ['Lauch|Porree', 24, 2, 3, 0.3, 2.3, 100, 'st:200,s:75', 'gem', ''],
    ['Kürbis|Hokkaido|Butternut|Butternutkürbis|Hokkaidokürbis', 35, 1.2, 6.5, 0.2, 2, 200, 'po:200,s:150', 'gem', ''],
    ['Sellerie|Staudensellerie|Knollensellerie|Fenchel|Pastinake|Pastinaken|Petersilienwurzel|Rettich|Radieschen', 20, 1.2, 3, 0.2, 2.5, 100, 'st:40,s:60', 'gem', ''],
    ['Oliven|Olive|grüne Oliven|schwarze Oliven', 140, 1, 1, 14, 3, 30, 'st:4,x:4,hv:30,s:20', 'gem', ''],
    ['Tomatenmark', 80, 4.5, 13, 0.5, 4, 15, 'el:15,tl:5', 'gem', ''],
    ['Steckrübe|Kohlrübe|Topinambur|Mairübchen|Rübe|Wurzelgemüse', 35, 1, 7, 0.2, 2.5, 150, 'po:150,st:150,s:100', 'gem', ''],
    ['Pak Choi|Pak Choy|Bok Choy|Asiasalat', 18, 1.6, 2, 0.2, 1.5, 150, 'po:150,st:150,s:100', 'gem', ''],

    // Fruit
    ['Apfel|Äpfel|Apfelstücke|Apfelschnitze', 52, 0.3, 11.5, 0.2, 2.4, 150, 'st:150,x:150,s:75', 'obst', ''],
    ['Banane|Bananen', 93, 1.1, 21, 0.2, 2, 120, 'st:120,x:120,s:60', 'obst', ''],
    ['Birne|Birnen', 55, 0.4, 12.5, 0.3, 3.3, 160, 'st:160,x:160,s:80', 'obst', ''],
    ['Orange|Orangen|Apfelsine|Apfelsinen|Blutorange|Grapefruit|Pampelmuse', 45, 1, 9, 0.2, 2, 150, 'st:150,x:150,s:75', 'obst', ''],
    ['Mandarine|Mandarinen|Clementine|Clementinen|Klementine|Klementinen|Satsuma|Satsumas', 50, 0.7, 10, 0.3, 1.7, 60, 'st:60,x:60,s:60', 'obst', ''],
    ['Beeren|Beerenmix|Waldbeeren|Mischbeeren|TK-Beeren|Tiefkühlbeeren|gemischte Beeren|Beerenmischung|Johannisbeeren|Brombeeren|frische Cranberries', 45, 1, 7, 0.5, 4, 125, 'hv:40,be:125,el:15,s:60', 'obst', ''],
    ['Erdbeeren|Erdbeere', 32, 0.8, 5.5, 0.4, 1.6, 150, 'st:15,x:15,hv:60,be:250,s:75', 'obst', ''],
    ['Heidelbeeren|Blaubeeren|Heidelbeere|Blaubeere', 40, 0.7, 7, 0.6, 4.5, 125, 'hv:40,be:125,el:15,s:60', 'obst', ''],
    ['Himbeeren|Himbeere', 36, 1.3, 4.8, 0.3, 6.7, 125, 'hv:40,be:125,el:15,s:60', 'obst', ''],
    ['Weintrauben|Trauben|Weintraube|Traube', 70, 0.7, 15.6, 0.3, 1.5, 125, 'hv:60,st:5,s:60', 'obst', ''],
    ['Kiwi|Kiwis', 51, 1, 9, 0.6, 2.1, 75, 'st:75,x:75,s:75', 'obst', ''],
    ['Mango|Mangos', 62, 0.6, 12.5, 0.4, 1.7, 150, 'x:300,st:300,s:75', 'obst', ''],
    ['Ananas', 55, 0.5, 12, 0.2, 1.4, 150, 'sch:80,s:75', 'obst', ''],
    ['Pfirsich|Pfirsiche|Nektarine|Nektarinen', 42, 0.8, 9, 0.1, 1.9, 130, 'st:130,x:130,s:65', 'obst', ''],
    ['Aprikose|Aprikosen|Marille|Marillen', 45, 0.9, 8.5, 0.1, 1.5, 120, 'st:40,x:40,s:60', 'obst', ''],
    ['Melone|Wassermelone|Honigmelone|Cantaloupe|Galiamelone|Melonenstücke', 35, 0.7, 7.5, 0.2, 0.5, 250, 'sch:250,st:250,s:100', 'obst', ''],
    ['Kirschen|Kirsche|Sauerkirschen|Süßkirschen', 60, 1, 13, 0.3, 1.3, 150, 'hv:80,st:7,s:75', 'obst', ''],
    ['Pflaumen|Pflaume|Zwetschgen|Zwetschge|Zwetschen|Zwetsche|Mirabellen|Mirabelle|Renekloden|Reneklode', 47, 0.6, 10, 0.2, 1.6, 150, 'st:30,x:30,hv:100,s:75', 'obst', ''],
    ['Datteln|Dattel', 285, 2, 65, 0.5, 8, 30, 'st:8,x:8', 'obst', ''],
    ['Rosinen|Sultaninen|Trockenobst|Trockenfrüchte|getrocknete Aprikosen|getrocknete Cranberries|Trockenpflaumen|getrocknete Feigen|Cranberries|Cranberrys', 300, 2.5, 68, 0.6, 5, 30, 'el:10,hv:30,s:20', 'obst', ''],
    ['Obst|Obstsalat|Früchte|Frucht|Fruchtsalat|Obstteller|Obststücke', 55, 0.7, 12, 0.3, 2, 150, 'po:150,s:75', 'obst', ''],
    ['Apfelmus|Apfelkompott|Kompott', 80, 0.3, 19, 0.1, 1.5, 100, 'el:20,s:60', 'obst', ''],
    ['Feigen|Feige', 70, 1.3, 13, 0.4, 3, 50, 'st:50,x:50', 'obst', ''],
    ['Papaya|Kaki|Sharonfrucht|Litschi|Lychee|Maracuja|Passionsfrucht|Guave|Drachenfrucht|Pitaya|exotische Früchte|Physalis|Kapstachelbeeren', 60, 0.8, 13, 0.3, 2.5, 150, 'st:150,x:150,hv:40,s:75', 'obst', ''],
    ['Bratapfel|Bratäpfel|Ofenapfel|gebackener Apfel', 120, 1, 22, 3, 2.5, 200, 'st:200,x:200', 'obst', ''],

    // Sweets and snacks
    ['Schokolade|Vollmilchschokolade|Milchschokolade|Schoki|Schoko|Nussschokolade|weiße Schokolade', 540, 8, 56, 31, 2, 25, 'st:5,reihe:20,tafel:100,ri:40', 'suess', ''],
    ['Zartbitterschokolade|Zartbitter|Bitterschokolade|dunkle Schokolade|Edelbitter|Edelbitterschokolade', 560, 8, 33, 41, 11, 20, 'st:5,reihe:20,tafel:100', 'suess', ''],
    ['Schokoriegel|Schokoladenriegel|Karamellriegel|Waffelriegel', 480, 5, 62, 23, 1.5, 50, 'st:50,x:50,ri:50', 'suess', ''],
    ['Gummibärchen|Gummibären|Fruchtgummi|Weingummi|Lakritz|Gummitiere', 340, 7, 77, 0.1, 0, 30, 'st:2,x:2,hv:30,pk:200', 'suess', ''],
    ['Bonbon|Bonbons|Lutscher|Karamellbonbon|Karamellbonbons|Hustenbonbon|Hustenbonbons|Lolli', 390, 0, 96, 0.5, 0, 5, 'st:5,x:5,hv:30', 'suess', ''],
    ['Praline|Pralinen|Trüffelpraline|Trüffelpralinen|Pralinés', 530, 6, 52, 33, 2, 12, 'st:12,x:12', 'suess', ''],
    ['Schokoweihnachtsmann|Schokonikolaus|Schokoladenweihnachtsmann|Schokoladennikolaus|Schokohase|Schokoladenhase|Osterhase', 535, 7, 57, 31, 2, 100, 'st:100,x:100', 'suess', ''],
    ['Überraschungsei|Überraschungseier|Schokoei|Schokoeier|Schokoladenei|Schokoladeneier', 550, 8, 53, 34, 1, 20, 'st:20,x:20', 'suess', ''],
    ['Rumkugeln|Rumkugel', 430, 5, 55, 21, 3, 30, 'st:15,x:15', 'suess', ''],
    ['Kuchen|Rührkuchen|Marmorkuchen|Streuselkuchen|Zitronenkuchen|Nusskuchen|Gugelhupf|Bienenstich|Schokokuchen|Schokoladenkuchen|Kuchenstück', 350, 5, 45, 17, 1.5, 100, 'st:100,x:100', 'suess', ''],
    ['Käsekuchen|Quarkkuchen|Cheesecake|Käsesahne', 230, 8, 24, 11, 0.5, 120, 'st:120,x:120', 'suess', ''],
    ['Torte|Sahnetorte|Schwarzwälder Kirschtorte|Buttercremetorte|Obsttorte|Frankfurter Kranz|Sachertorte', 290, 4, 31, 17, 1, 120, 'st:120,x:120', 'suess', ''],
    ['Obstkuchen|Apfelkuchen|Pflaumenkuchen|Zwetschgenkuchen|Erdbeerkuchen|Kirschkuchen|Rhabarberkuchen|Apfelstrudel|Strudel', 220, 3.5, 32, 8, 2, 120, 'st:120,x:120', 'suess', ''],
    ['Keks|Kekse|Butterkeks|Butterkekse|Plätzchen|Cookies|Cookie|Doppelkeks|Spekulatius|Vanillekipferl|Zimtsterne|Butterplätzchen|Weihnachtsplätzchen|Spitzbuben|Makronen|Kokosmakronen|Spritzgebäck|Pfeffernüsse|Amarettini|Cantuccini|Cantucci', 470, 7, 68, 19, 2, 30, 'st:10,x:10,hv:30', 'suess', ''],
    ['Löffelbiskuit|Löffelbiskuits', 390, 8.5, 80, 4, 1, 30, 'st:6,x:6,hv:30', 'suess', ''],
    ['Berliner|Krapfen|Kreppel|Donut|Donuts|Berliner Pfannkuchen', 370, 6, 48, 17, 1.5, 70, 'st:70,x:70', 'suess', ''],
    ['Nussecke|Nussecken|Nussschnitte', 470, 7, 48, 28, 3, 100, 'st:100,x:100', 'suess', ''],
    ['Amerikaner', 365, 6, 64, 9, 1.5, 80, 'st:80,x:80', 'suess', ''],
    ['Germknödel|Dampfnudel|Dampfnudeln|Hefeknödel|Hefeklöße|Hefekloß|Rohrnudeln', 260, 6, 40, 8, 1.5, 180, 'st:180,x:180', 'suess', ''],
    ['Muffin|Muffins|Brownie|Brownies|Cupcake|Cupcakes', 400, 5.5, 50, 20, 1.5, 80, 'st:80,x:80', 'suess', ''],
    ['Waffel|Waffeln|Belgische Waffel', 330, 6, 42, 15, 1, 60, 'st:60,x:60', 'suess', ''],
    ['Eis|Eiscreme|Speiseeis|Eiskugel|Eiskugeln|Softeis|Eis am Stiel|Gelato|Sorbet|Erdbeereis|Himbeereis|Heidelbeereis|Waldbeereis|Johannisbeereis|Wassereis', 200, 3.5, 24, 10, 0.5, 120, 'ku:60,st:70,x:120,be:500', 'suess', ''],
    ['Chips|Kartoffelchips|Crisps|Tortillachips|Nachos|Paprikachips', 535, 6, 50, 34, 4, 30, 'hv:25,pk:175', 'suess', ''],
    ['Salzstangen|Salzbrezeln|Brezelsticks|Salzbrezel|Cracker|Kräcker', 390, 10, 74, 5, 3.5, 30, 'hv:25,pk:250', 'suess', ''],
    ['Popcorn', 430, 8, 60, 17, 10, 30, 'hv:15,pk:100', 'suess', ''],
    ['Müsliriegel|Getreideriegel|Haferriegel|Energieriegel|Riegel|Fruchtriegel|Nussriegel|Granolariegel', 420, 6, 62, 15, 5, 25, 'st:25,x:25,ri:25', 'suess', ''],
    ['Reiswaffel|Reiswaffeln|Maiswaffel|Maiswaffeln|Reiscracker', 385, 8, 81, 3, 4, 8, 'st:8,x:8', 'getreide', ''],
    ['Honig|Blütenhonig|Waldhonig|Ahornsirup|Agavendicksaft|Sirup', 305, 0.4, 76, 0, 0, 10, 'tl:8,el:20,s:10,h:8', 'suess', ''],
    ['Marmelade|Konfitüre|Gelee|Fruchtaufstrich|Erdbeermarmelade|Aprikosenmarmelade', 250, 0.4, 60, 0.1, 1, 20, 'tl:8,el:20,s:15', 'suess', ''],
    ['Nuss-Nougat-Creme|Nussnougatcreme|Nutella|Schokoaufstrich|Schokocreme|Haselnusscreme', 540, 6, 57, 31, 3.5, 15, 'tl:8,el:15,s:15', 'suess', ''],
    ['Zucker|Rohrzucker|Würfelzucker|Zuckerwürfel', 400, 0, 100, 0, 0, 4, 'tl:4,el:12,st:3,x:3,s:4,h:4', 'suess', ''],
    ['Kakao|heiße Schokolade|Trinkschokolade|Kakaogetränk|Schokomilch|Kakaomilch', 80, 3.5, 11, 2.5, 0.5, 250, 'ta:250,gl:250,be:300,x:250', 'getraenk', 'dh'],
    ['Milchshake|Milkshake|Bananenshake|Erdbeershake|Schokoshake|Bananenmilch', 110, 3.5, 17, 3, 0, 300, 'be:300,gl:300,x:300', 'getraenk', 'd'],
    ['Stollen|Christstollen|Weihnachtsstollen|Butterstollen|Mandelstollen|Quarkstollen|Marzipanstollen|Mohnstollen|Stollenkonfekt', 400, 6, 55, 17, 2.5, 50, 'sch:50,st:50,x:50', 'suess', ''],
    ['Lebkuchen|Elisenlebkuchen|Pfefferkuchen|Honigkuchen|Printen|Aachener Printen|Lebkuchenherz|Magenbrot', 380, 6, 65, 10, 3, 40, 'st:40,x:40', 'suess', ''],
    ['Dominosteine|Dominostein', 380, 4.5, 65, 11, 2.5, 36, 'st:12,x:12', 'suess', ''],
    ['Marzipan|Marzipanbrot|Marzipanriegel|Marzipanschwein', 460, 8, 50, 25, 3, 50, 'st:50,x:50,ri:40', 'suess', ''],
    ['Marzipankartoffeln|Marzipankugeln|Bethmännchen', 460, 8, 50, 25, 3, 50, 'st:10,x:10', 'suess', ''],
    ['Zimtschnecke|Cinnamon Roll|Kanelbulle|Zimtknoten|Nussschnecke|Puddingschnecke|Rosinenschnecke|Mohnschnecke', 360, 6, 50, 15, 2, 90, 'st:90,x:90', 'suess', ''],
    ['Apfeltasche|Kirschtasche|Quarktasche|Plunder|Plunderstück|Plundergebäck|Puddingbrezel|Puddingteilchen|Teilchen|Hefeteilchen|Blätterteigtasche|Kopenhagener', 330, 4.5, 38, 17.5, 1.5, 100, 'st:100,x:100', 'suess', ''],
    ['Tiramisu|Tiramisù', 280, 5, 28, 16.5, 0.5, 150, 'po:150,st:150,x:150', 'suess', ''],
    ['Mousse au Chocolat|Schokomousse|Schokoladenmousse|Mousse', 300, 5, 25, 20, 1.5, 100, 'po:100,be:100,x:100', 'suess', ''],
    ['Panna Cotta|Crème brûlée|Creme brulee|Crema Catalana', 250, 3, 20, 18, 0, 120, 'po:120,st:120,x:120', 'suess', ''],
    ['Kaiserschmarrn|Kaiserschmarren|Schmarrn', 220, 7, 28, 9, 1, 300, 'po:300,x:300', 'suess', ''],
    ['Arme Ritter|Armer Ritter|French Toast|Pain perdu', 230, 8, 27, 10, 1.5, 150, 'st:75,sch:75,x:75', 'suess', ''],
    ['Energy Balls|Energiebällchen|Energy Bites|Dattelbällchen|Protein Balls|Proteinbällchen', 400, 10, 45, 18, 7, 40, 'st:20,x:20', 'suess', ''],
    ['Erdnussflips|Flips|Erdnusslocken', 520, 13, 50, 30, 3, 30, 'hv:30,pk:150,po:30', 'suess', ''],

    // Drinks
    ['Wasser|Mineralwasser|Sprudel|Leitungswasser|Sprudelwasser|stilles Wasser|Tafelwasser', 0, 0, 0, 0, 0, 250, 'gl:250,fl:500,ta:250,x:250', 'getraenk', 'dw'],
    ['Kokoswasser', 19, 0.2, 4.5, 0, 0, 330, 'gl:250,fl:330,do:330,pk:330,x:330', 'getraenk', 'dw'],
    ['Iso-Drink|Isodrink|isotonisches Getränk|Sportgetränk|Elektrolytgetränk', 24, 0, 6, 0, 0, 500, 'fl:500,gl:250,x:500', 'getraenk', 'dw'],
    ['Kaffee|Filterkaffee|Kaffee schwarz|schwarzer Kaffee|Americano|Café Crema|Caffè Crema|Kaffee Crema|Crema|Bohnenkaffee', 2, 0.2, 0.3, 0, 0, 150, 'ta:150,be:250,gl:200,x:150', 'getraenk', 'dhkw'],
    ['Espresso|Espressi|Ristretto|Doppio|Lungo', 2, 0.1, 0.3, 0, 0, 30, 'ta:30,x:30', 'getraenk', 'dhk'],
    ['Cappuccino|Cappu|Flat White|Cortado', 43, 2.2, 3.2, 2.3, 0, 150, 'ta:150,be:250,x:150', 'getraenk', 'dhk'],
    ['Latte Macchiato|Latte|Milchkaffee|Café au Lait|Caffè Latte|Kaffee Latte', 50, 2.6, 3.8, 2.8, 0, 300, 'gl:300,ta:300,be:350,x:300', 'getraenk', 'dhk'],
    ['Eiskaffee', 95, 2, 11, 4.8, 0, 300, 'gl:300,be:300,x:300', 'getraenk', 'dk'],
    ['Chai Latte|Matcha Latte', 70, 2.5, 10, 2.5, 0, 300, 'gl:300,ta:300,x:300', 'getraenk', 'dh'],
    ['Tee|Kräutertee|Früchtetee|grüner Tee|schwarzer Tee|Pfefferminztee|Ingwertee|Kamillentee|Rooibos|Rooibostee|Fencheltee|Salbeitee|Earl Grey', 1, 0, 0.2, 0, 0, 250, 'ta:250,be:300,gl:250,kanne:1000,x:250', 'getraenk', 'dhw'],
    ['Orangensaft|O-Saft|Saft|Fruchtsaft|Multivitaminsaft|Multisaft|Grapefruitsaft|Direktsaft|Ananassaft|Mangosaft', 45, 0.7, 9.5, 0.2, 0.2, 200, 'gl:200,fl:1000,x:200', 'getraenk', 'd'],
    ['Apfelsaft|Apfeldirektsaft|naturtrüber Apfelsaft', 46, 0.1, 11, 0.1, 0.1, 200, 'gl:200,fl:1000,x:200', 'getraenk', 'd'],
    ['Apfelschorle|Schorle|Saftschorle|Fruchtschorle|Johannisbeerschorle|Rhabarberschorle|Apfelsaftschorle', 24, 0, 5.5, 0, 0, 300, 'gl:300,fl:500,x:300', 'getraenk', 'dw'],
    ['Cola|Limo|Limonade|Spezi|Eistee|Softdrink|Brause|Orangenlimonade|Zitronenlimonade|Ginger Ale|Tonic|Tonic Water|Bitter Lemon|Fassbrause|Fanta|Sprite|Mezzo Mix|Mezzomix|Seven Up|Almdudler|Bionade|Ginger Beer|Ingwerbier', 42, 0, 10.6, 0, 0, 330, 'do:330,gl:250,fl:500,x:330', 'getraenk', 'd'],
    ['Cola Zero|Cola light|Cola zuckerfrei|Limo zuckerfrei|zuckerfreie Limo|Light-Limo|Zero|Coke Zero|Pepsi Max|Fanta Zero|Sprite Zero', 0.3, 0, 0.1, 0, 0, 330, 'do:330,gl:250,fl:500,x:330', 'getraenk', 'd'],
    ['Energy Drink|Energydrink|Energy', 45, 0, 11, 0, 0, 250, 'do:250,x:250', 'getraenk', 'd'],
    ['Bier|Pils|Pilsener|~Helles|~Weizen|Weißbier|Hefeweizen|~Export|Kölsch|Altbier|~Lager|~Dunkles|Bockbier|Märzen|Weizenbier|Pale Ale|IPA|Craft Beer|Craftbeer', 43, 0.5, 3.1, 0, 0, 500, 'gl:300,fl:500,do:500,x:500', 'getraenk', 'da'],
    ['Radler|Alster|Alsterwasser|Panaché', 40, 0.3, 6, 0, 0, 500, 'gl:300,fl:500,x:500', 'getraenk', 'da'],
    ['alkoholfreies Bier|Bier alkoholfrei|alkoholfrei|alkoholfreies Weizen|Weizen alkoholfrei|Pils alkoholfrei', 25, 0.4, 5.5, 0, 0, 500, 'gl:300,fl:500,x:500', 'getraenk', 'd'],
    ['Malzbier|Malztrunk|Karamalz|Vitamalz', 45, 0.4, 10.5, 0, 0, 330, 'fl:330,gl:250,do:330,x:330', 'getraenk', 'd'],
    ['alkoholfreier Wein|Wein alkoholfrei|alkoholfreier Sekt|Sekt alkoholfrei|alkoholfreier Prosecco|Prosecco alkoholfrei|Kindersekt', 25, 0, 6, 0, 0, 200, 'gl:200,fl:750,x:200', 'getraenk', 'd'],
    ['alkoholfreier Cocktail|Mocktail|Mocktails|Virgin Cocktail|alkoholfreier Drink|alkoholfreier Longdrink', 50, 0.1, 12, 0, 0.2, 250, 'gl:250,x:250', 'getraenk', 'd'],
    ['Wein|Rotwein|Weißwein|~Rosé|Roséwein|Sekt|Prosecco|Champagner|Cava|Riesling|Grauburgunder|Weißburgunder|Spätburgunder|Federweißer|Crémant', 75, 0.1, 2.5, 0, 0, 200, 'gl:200,fl:750,x:200', 'getraenk', 'da'],
    ['Glühwein|Punsch|Grog|Jagertee|Jägertee|Feuerzangenbowle', 100, 0, 12, 0, 0, 200, 'ta:200,gl:200,x:200', 'getraenk', 'dah'],
    ['Weinschorle|Weißweinschorle|Rotweinschorle|Gespritzter', 38, 0, 1.3, 0, 0, 250, 'gl:250,x:250', 'getraenk', 'da'],
    ['Apfelwein|Ebbelwoi|Äppler|Äppelwoi|Ebbelwei|Stöffche|Cidre|Cider', 45, 0, 2, 0, 0, 300, 'gl:300,fl:1000,x:300', 'getraenk', 'da'],
    ['Schnaps|Wodka|Whisky|Whiskey|Gin|Rum|Obstler|Tequila|Ouzo|Grappa|~Kurzer|~Klarer|~Shot|~Shots|Brandy|Likör|Amaretto|Weinbrand|Cognac|Sambuca|Calvados|Jägermeister|Kräuterlikör|Kräuterschnaps|Doppelkorn|Kornbrand|Campari', 230, 0, 2, 0, 0, 20, 'gl:20,x:20', 'getraenk', 'da'],
    ['Cocktail|Aperol Spritz|Spritz|Hugo|Mojito|Caipirinha|Gin Tonic|Longdrink|Lillet|Lillet Wild Berry|Martini|Aperol|Cuba Libre|Pina Colada|Moscow Mule|Negroni|Espresso Martini|White Russian|Daiquiri', 90, 0, 9, 0, 0, 250, 'gl:250,x:250', 'getraenk', 'da'],
    ['Erdbeerbowle|Maibowle|Pfirsichbowle|Sangria', 80, 0.1, 8, 0, 0.1, 200, 'gl:200,x:200', 'getraenk', 'da'],
    ['Eierlikör|Sahnelikör|Baileys', 300, 3, 25, 12, 0, 20, 'gl:20,x:20', 'getraenk', 'da'],
    ['Hard Seltzer', 30, 0, 0.5, 0, 0, 330, 'do:330,x:330', 'getraenk', 'da'],
    ['Smoothie|Fruchtsmoothie|grüner Smoothie', 55, 0.7, 12, 0.3, 1.5, 250, 'gl:250,fl:250,x:250', 'getraenk', 'd'],
    ['Kinderpunsch|alkoholfreier Punsch|Früchtepunsch|Apfelpunsch|alkoholfreier Glühwein|Punsch ohne Alkohol|Glühwein ohne Alkohol|heißer Apfelsaft', 50, 0.1, 12, 0, 0, 200, 'ta:200,gl:200,x:200', 'getraenk', 'dh'],
    ['Traubensaft|Kirschsaft|Johannisbeersaft|Kirschnektar|Johannisbeernektar|Holundersaft', 70, 0.3, 16.5, 0, 0.1, 200, 'gl:200,fl:1000,x:200', 'getraenk', 'd'],
    ['Mate-Limonade|Club-Mate|Mate|Mate-Limo', 20, 0, 5, 0, 0, 500, 'fl:500,do:330,gl:250,x:500', 'getraenk', 'd'],
    ['Kombucha', 15, 0, 3.5, 0, 0, 330, 'fl:330,gl:250,x:330', 'getraenk', 'd'],

    // Dishes
    ['Spaghetti Bolognese|Nudeln Bolognese|Pasta Bolognese|Bolognese|Spaghetti Bolo|Nudeln mit Bolognese|Spaghetti mit Bolognese|Pasta mit Bolognese|Nudeln mit Hackfleischsoße|Spaghetti mit Hackfleischsoße', 140, 7, 17, 4.5, 1.7, 450, 'po:450,x:450', 'gericht', ''],
    ['Nudeln mit Tomatensoße|Spaghetti mit Tomatensoße|Pasta mit Tomatensoße|Nudeln mit Tomatensauce|Spaghetti Napoli|Pasta Napoli|Pasta Arrabbiata|Penne Arrabbiata|Spaghetti Pomodoro|Pasta Pomodoro', 120, 4, 22, 1.8, 2.2, 450, 'po:450,x:450', 'gericht', ''],
    ['Carbonara|Spaghetti Carbonara|Pasta Carbonara|Nudeln Carbonara|Nudeln mit Sahnesoße|Pasta mit Sahnesoße|Nudeln mit Lachs|Tagliatelle mit Lachs', 200, 8, 22, 9, 1.5, 400, 'po:400,x:400', 'gericht', ''],
    ['Pesto-Nudeln|Nudeln mit Pesto|Pasta mit Pesto|Spaghetti mit Pesto|Pasta Pesto', 220, 6.5, 26, 10, 2, 400, 'po:400,x:400', 'gericht', 'z'],
    ['Lasagne|Lasagna|Gemüselasagne|Spinatlasagne', 150, 8, 12, 7.5, 1.2, 400, 'po:400,st:400,x:400', 'gericht', ''],
    ['Chili con Carne|Chili|Chili sin Carne', 105, 7.5, 9, 4, 3.5, 400, 'po:400,x:400', 'gericht', ''],
    ['Gulasch|Rindergulasch|Gulaschsuppe|Schweinegulasch|Geschnetzeltes|Züricher Geschnetzeltes|Stroganoff', 130, 14, 4, 6.5, 0.5, 300, 'po:300,x:300', 'gericht', ''],
    ['Eintopf|Linseneintopf|Linsensuppe|Erbseneintopf|Erbsensuppe|Bohneneintopf|Bohnensuppe|Kartoffeleintopf|Gemüseeintopf|Linsen mit Spätzle|Kichererbseneintopf|Dal|Dhal|Linsencurry|Pichelsteiner', 90, 5.5, 10, 2.8, 3.5, 400, 'po:400,ta:250,x:400', 'gericht', ''],
    ['Suppe|Gemüsesuppe|Tomatensuppe|Kürbissuppe|Brühe|Hühnersuppe|Hühnerbrühe|Kartoffelsuppe|Cremesuppe|Minestrone|Gemüsebrühe|Rinderbrühe|Misosuppe|Miso-Suppe', 45, 2, 6, 1.6, 1.2, 300, 'po:300,ta:250,x:300', 'gericht', ''],
    ['Ramen|Pho|Nudelsuppe|Hühnernudelsuppe|Udon|Udonsuppe|Wan Tan Suppe|Wantan Suppe|Wantansuppe|Wonton Suppe|Wontonsuppe', 85, 5, 11, 2.5, 1, 500, 'po:500,x:500', 'gericht', ''],
    ['Kartoffelsalat', 140, 2, 13, 9, 1.5, 200, 'po:200,s:200', 'gericht', ''],
    ['Nudelsalat', 210, 5, 20, 12, 1.5, 200, 'po:200,s:200', 'gericht', ''],
    ['Eiersalat|Thunfischsalat|Fleischsalat|Wurstsalat|Geflügelsalat|Hähnchensalat|Heringssalat|Salat mit Mayonnaise', 220, 9, 3, 19, 0.5, 100, 'po:150,el:30,s:50', 'gericht', ''],
    ['Curry|Thai-Curry|Hähnchencurry|Gemüsecurry|rotes Curry|grünes Curry|Butter Chicken|Tikka Masala|Chicken Tikka Masala|Chicken Curry|Korma|Tofucurry|Kokoscurry', 130, 8, 6, 8.5, 1.5, 350, 'po:350,x:350', 'gericht', ''],
    ['gebratener Reis|Bratreis|gebratene Nudeln|Bami Goreng|Nasi Goreng|Asia-Nudeln|Asianudeln|Mie-Nudeln|Pad Thai|Chow Mein|Wokgericht|gebratene Reisnudeln|Biryani|Reispfanne', 165, 6, 22, 6, 1.5, 400, 'po:400,x:400', 'gericht', ''],
    ['Bowl|Poke|Poke Bowl|Pokebowl|Buddha Bowl|Burrito Bowl|Reisbowl|Salatbowl', 130, 7, 15, 4.5, 2.5, 450, 'po:450,x:450', 'gericht', ''],
    ['Burrito|Enchilada|Enchiladas|Quesadilla|Quesadillas|Fajita|Fajitas', 190, 9, 22, 7.5, 2.5, 300, 'st:300,x:300', 'gericht', ''],
    ['Taco|Tacos', 210, 9, 20, 10, 2.5, 200, 'st:100,x:100', 'gericht', ''],
    ['Auflauf|Nudelauflauf|Kartoffelauflauf|Gratin|Kartoffelgratin|Gemüseauflauf|Moussaka', 150, 6, 12, 8.5, 1.5, 350, 'po:350,x:350', 'gericht', ''],
    ['Käsespätzle|Kässpätzle|Kasnocken|Makkaroni mit Käse|Mac and Cheese', 240, 10, 25, 11, 1.5, 350, 'po:350,x:350', 'gericht', ''],
    ['Maultaschen|Maultasche', 190, 9, 22, 7, 1.5, 280, 'st:70,x:70', 'gericht', ''],
    ['Risotto|Pilzrisotto|Spargelrisotto', 150, 3.5, 22, 5, 0.5, 350, 'po:350,x:350', 'gericht', ''],
    ['Paella', 150, 9, 19, 4, 1, 400, 'po:400,x:400', 'gericht', ''],
    ['Schaschlik|Schaschlikspieß', 155, 14, 7, 8, 1, 300, 'st:150,po:300,x:150', 'gericht', ''],
    ['Grillteller|Grillplatte|Mixed Grill|Fleischplatte', 230, 25, 3, 13.5, 0.5, 350, 'po:350,x:350', 'gericht', ''],
    ['Königsberger Klopse|Königsberger Klops|Klopse', 160, 11, 7, 10, 0.5, 350, 'po:350,x:350', 'gericht', ''],
    ['gefüllte Paprika|gefüllte Paprikaschoten|gefüllte Paprikaschote', 110, 7, 7, 6, 1.5, 350, 'st:175,po:350,x:175', 'gericht', ''],
    ['Raclette|Racletteabend', 210, 10, 14, 13, 1, 450, 'po:450,x:450', 'gericht', ''],
    ['Käsefondue|Fondue|Schweizer Fondue', 250, 12, 22, 12, 1, 400, 'po:400,x:400', 'gericht', ''],
    ['Fleischfondue|Fondue chinoise|Brühfondue', 160, 17, 6, 7.5, 0.5, 400, 'po:400,x:400', 'gericht', ''],
    ['belegtes Brötchen|Käsebrötchen|Schinkenbrötchen|Salamibrötchen|Wurstbrötchen|Mettbrötchen|Fischbrötchen|Lachsbrötchen|Frikadellenbrötchen|Eibrötchen|Schnitzelbrötchen|Brötchen belegt', 297, 12, 32, 12.5, 1.8, 100, 'st:100,x:100', 'gericht', ''],
    ['belegtes Brot|Butterbrot|Käsebrot|Wurstbrot|Schinkenbrot|Stulle|Stullen|Bemme|Pausenbrot|Brot belegt|Schmalzbrot|Schmalzstulle|Griebenschmalzbrot', 317, 11.8, 25, 18, 3.3, 80, 'st:80,x:80,sch:80', 'gericht', ''],
    ['Leberkäsbrötchen|Leberkäsebrötchen|Leberkäsweck|Leberkäseweck|Fleischkäsbrötchen|Fleischkäsebrötchen|Leberkässemmel|Leberkäsesemmel', 285, 11, 25, 15.5, 1.5, 180, 'st:180,x:180', 'gericht', ''],
    ['Sandwich|Club Sandwich|Clubsandwich|Panini|Baguette|belegtes Baguette|Baguette belegt|Ciabatta belegt|Bagel belegt', 260, 11, 30, 10.5, 2, 200, 'st:200,x:200', 'gericht', ''],
    ['Hot Dog|Hotdog', 250, 10, 22, 13, 1, 150, 'st:150,x:150', 'gericht', ''],
    ['Wrap mit Hähnchen|Hähnchenwrap|Hähnchen-Wrap|Chicken Wrap|Chickenwrap|Wrap gefüllt|gefüllter Wrap', 200, 11, 21, 7.5, 2, 250, 'st:250,x:250', 'gericht', ''],
    ['Grüne Soße|Grüne Sauce|Grie Soß|Frankfurter Grüne Soße', 120, 4, 4, 10, 0.5, 150, 'po:150,s:100', 'gericht', ''],
    ['Langos|Lángos|Langosch', 280, 7, 32, 13, 1.5, 250, 'st:250,x:250', 'gericht', 'z'],
    ['Lahmacun|türkische Pizza', 220, 9, 30, 7, 2, 200, 'st:200,x:200', 'gericht', 'z'],
    ['Pide', 250, 11, 32, 8.5, 1.5, 350, 'st:350,x:350', 'gericht', ''],
    ['Börek|Burek|Sigara Börek|Spinatbörek|Käsebörek|Hackbörek', 300, 9, 28, 17, 1.5, 150, 'st:150,x:150', 'gericht', ''],
    ['Frühlingsrolle|Frühlingsrollen|Spring Rolls|Minifrühlingsrollen|Samosa|Samosas', 230, 5, 25, 12, 2, 120, 'st:60,x:60', 'gericht', ''],
    ['Gyoza|Dumplings|Dim Sum|Wan Tan|Wantan|Wontons|Jiaozi|Teigtaschen|Momos', 200, 8, 25, 7.5, 1.5, 150, 'st:25,x:25,po:150', 'gericht', ''],
    ['Quiche|Quiche Lorraine|Gemüsequiche|Lauchquiche|Spinatquiche', 270, 9, 18, 18, 1, 150, 'st:150,x:150', 'gericht', ''],
    ['Zwiebelkuchen', 235, 7, 22, 13, 1.5, 150, 'st:150,x:150', 'gericht', 'z'],
    ['Strammer Max', 220, 13, 15, 12, 1.5, 200, 'po:200,st:200,x:200', 'gericht', ''],
    ['Bauernfrühstück', 170, 7, 12, 10.5, 1.5, 350, 'po:350,x:350', 'gericht', 'z'],
    ['Shakshuka|Schakschuka|Eier in Tomatensoße', 110, 6, 6, 7, 1.5, 350, 'po:350,x:350', 'gericht', 'z'],
    ['Hühnerfrikassee|Frikassee|Hühnchenfrikassee|Geflügelfrikassee|Ragout fin', 130, 11, 5, 7.5, 0.5, 300, 'po:300,x:300', 'gericht', ''],
    ['Caesar Salad|Caesar Salat|Caesars Salad|Cäsarsalat', 150, 8, 7, 10, 1.5, 300, 'po:300,x:300', 'gericht', ''],
    ['griechischer Salat|Bauernsalat|Hirtensalat|Greek Salad', 110, 4, 4, 9, 1.5, 300, 'po:300,x:300', 'gericht', 'z'],
    ['Caprese|Tomate Mozzarella|Insalata Caprese|Tomaten mit Mozzarella', 160, 9, 3, 12.5, 1, 250, 'po:250,x:250', 'gericht', ''],

    // Fats, sauces, spreads
    ['Öl|Olivenöl|Rapsöl|Sonnenblumenöl|Pflanzenöl|Bratöl|Leinöl|Kokosöl|Sesamöl|Walnussöl|Kürbiskernöl|Speiseöl|Butterschmalz|Ghee|Schmalz', 880, 0, 0, 99.5, 0, 10, 'el:10,tl:4,s:10', 'fett', ''],
    ['Mayonnaise|Mayo|Remoulade|Salatmayonnaise|Burgersoße|Burgersauce|Cocktailsoße|Cocktailsauce', 650, 1.1, 3, 70, 0, 15, 'el:15,tl:5,s:15', 'fett', ''],
    ['Mayo light|Salatcreme|Mayonnaise light|leichte Mayonnaise', 280, 1, 12, 25, 0, 15, 'el:15,tl:5,s:15', 'fett', ''],
    ['Ketchup|Tomatenketchup|Currysoße|Currysauce|Curryketchup|Barbecuesoße|Barbecuesauce|BBQ-Soße|BBQ-Sauce|Grillsoße|Chilisoße|Sweet Chili|Süß-Sauer-Soße', 110, 1.2, 25, 0.1, 0.5, 15, 'el:15,tl:5,s:15', 'fett', ''],
    ['Senf|Dijonsenf|süßer Senf|mittelscharfer Senf', 90, 6, 6, 4, 2, 5, 'tl:5,el:15,s:5', 'fett', ''],
    ['Pesto|Pesto Genovese|Basilikumpesto|Pesto Rosso|Bärlauchpesto|grünes Pesto|rotes Pesto', 460, 5, 6, 45, 2, 30, 'el:15,tl:5,s:30', 'fett', 'z'],
    ['Dressing|Salatdressing|Vinaigrette|Salatsoße|Salatsauce|Joghurtdressing|Balsamico-Dressing|Honig-Senf-Dressing|Caesar Dressing', 300, 1, 8, 28, 0, 30, 'el:15,s:30', 'fett', ''],
    ['Balsamico|Essig|Balsamicoessig|Aceto Balsamico|Apfelessig', 90, 0.5, 17, 0, 0, 10, 'el:15,tl:5,s:10', 'fett', ''],
    ['Tomatensoße|Tomatensauce|Passata|Sugo|Pastasoße|Nudelsoße|Arrabbiata|passierte Tomaten|Dosentomaten|gehackte Tomaten|stückige Tomaten|Pizzasoße', 40, 1.5, 6, 1, 1.5, 150, 'po:150,el:20,do:400,s:100', 'gem', ''],
    ['Soße|Sauce|Bratensoße|Rahmsoße|Jägersoße|Sahnesoße|Pilzsoße|Bratensauce|Rahmsauce|Jägersauce|Pfeffersoße|Käsesoße|Bechamel|Béchamel|Bechamelsoße|Sahnesauce|Champignonsoße|Zwiebelsoße', 100, 1.5, 5, 8, 0.3, 80, 'po:80,el:15,s:60', 'fett', ''],
    ['Hollandaise|Sauce Hollandaise|Soße Hollandaise', 450, 2, 4, 47, 0, 50, 'el:15,s:40', 'fett', ''],
    ['Sojasoße|Sojasauce|Soja-Soße|Teriyaki|Teriyakisoße|Teriyaki-Sauce|Shoyu', 60, 8, 6, 0, 0, 15, 'el:15,tl:5,s:15', 'fett', ''],
    ['Tzatziki|Zaziki|Knoblauchquark', 110, 4, 4, 8, 0.3, 50, 'el:20,s:40', 'milch', 'z'],
    ['Kräuterquark|Quarkdip|Dip|Sour Cream|Kräuterdip', 130, 9, 4, 8.5, 0.3, 50, 'el:20,s:40', 'milch', ''],
    ['Guacamole|Avocadocreme|Avocadodip', 150, 2, 4, 13, 5, 50, 'el:20,s:40', 'fett', ''],

    // Spices and the like: recognised, but nothing worth logging
    ['Salz|Pfeffer|Gewürze|Kräuter|Petersilie|Schnittlauch|Basilikum|Zimt|Paprikapulver|Oregano|Thymian|Rosmarin|Dill|Koriander|Kurkuma|Chiliflocken|Muskat|Ingwer|Zitronensaft|Limettensaft|Süßstoff|Stevia|Eiswürfel|Ingwershot|Ingwer-Shot|Zitrone|Limette|Vanille|Hefe|Backpulver', 0, 0, 0, 0, 0, 1, '', 'gewuerz', 'i']
  ];

  // ---------- Text helpers ----------
  const norm = s => String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/[„“”"'’`´]/g, '').replace(/(?<!\d)[-‐–—/]|[-‐–—/](?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
  // One-step stem so that singular and plural meet: tomaten/tomate, nudeln/nudel, karotten/karotte
  const stem = w => { if (w.length < 5) return w; for (const s of ['en', 'er', 'es', 'n', 'e', 's']) if (w.endsWith(s)) return w.slice(0, -s.length); return w; };
  const r1 = n => Math.round(n * 10) / 10;
  const fmtQ = q => String(Math.round(q * 100) / 100).replace('.', ',');

  const UNIT_G = { el: 15, tl: 5, sch: 30, gl: 200, ta: 150, be: 150, do: 200, pk: 250, hv: 30, ri: 50, ku: 60, fl: 500, ms: 30, ze: 3, pr: 1, sc: 30, tafel: 100, reihe: 20, kolben: 150, kanne: 1000 };
  const UNIT_LBL = { st: ['Stück', 'Stück'], x: ['Stück', 'Stück'], sch: ['Scheibe', 'Scheiben'], el: ['EL', 'EL'], tl: ['TL', 'TL'], gl: ['Glas', 'Gläser'], ta: ['Tasse', 'Tassen'], be: ['Becher', 'Becher'],
    do: ['Dose', 'Dosen'], pk: ['Packung', 'Packungen'], po: ['Portion', 'Portionen'], hv: ['Handvoll', 'Handvoll'], ri: ['Riegel', 'Riegel'], ku: ['Kugel', 'Kugeln'], fl: ['Flasche', 'Flaschen'],
    ms: ['Messlöffel', 'Messlöffel'], ze: ['Zehe', 'Zehen'], pr: ['Prise', 'Prisen'], sc: ['Schuss', 'Schuss'], tafel: ['Tafel', 'Tafeln'], reihe: ['Reihe', 'Reihen'], kolben: ['Kolben', 'Kolben'], kanne: ['Kanne', 'Kannen'] };
  const MASS = { g: 1, gr: 1, gramm: 1, grm: 1, kg: 1000, kilo: 1000, kilogramm: 1000, ml: 1, milliliter: 1, l: 1000, liter: 1000, ltr: 1000, cl: 10, dl: 100 };
  const UNIT_W = [
    [/^(el|essl[öo]ffel|essl)$/, 'el'], [/^(tl|teel[öo]ffel|teel)$/, 'tl'], [/^(scheibe|scheiben|scheibchen|sch)$/, 'sch'],
    [/^(st|stk|stck|stück|stücke|stücken|stueck|teil|teile)$/, 'st'], [/^(glas|gläser|glaeser|gläschen)$/, 'gl'], [/^(tasse|tassen|tässchen)$/, 'ta'],
    [/^(becher|pott)$/, 'be'], [/^(dose|dosen|büchse)$/, 'do'], [/^(packung|packungen|pck|pkg|päckchen|paket|tüte|tüten|beutel)$/, 'pk'],
    [/^(portion|portionen|teller|schale|schälchen|schüssel|schüsseln)$/, 'po'], [/^(handvoll)$/, 'hv'], [/^(riegel)$/, 'ri'], [/^(kugel|kugeln)$/, 'ku'],
    [/^(flasche|flaschen|fl)$/, 'fl'], [/^(messlöffel|messloeffel|scoop|scoops|messbecher)$/, 'ms'], [/^(zehe|zehen)$/, 'ze'], [/^(prise|prisen)$/, 'pr'],
    [/^(schuss|schluck)$/, 'sc'], [/^(tafel|tafeln)$/, 'tafel'], [/^(reihe|reihen|rippe|rippen)$/, 'reihe'], [/^(kolben)$/, 'kolben'], [/^(kanne|kannen)$/, 'kanne']
  ];
  const NUMW = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
    halb: 0.5, halbe: 0.5, halben: 0.5, halber: 0.5, halbes: 0.5, anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5, paar: 1, viertel: 0.25, dreiviertel: 0.75,
    doppelt: 2, doppelte: 2, doppelter: 2, doppeltes: 2, doppelten: 2 };
  const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  const SIZE = [[/^(gross|grosse|grosser|grosses|grossen|riesig|riesige|riesiger|riesiges|xxl|xl)$/, 1.5], [/^(klein|kleine|kleiner|kleines|kleinen|mini)$/, 0.6], [/^(etwas|bisschen|wenig)$/, 0.5], [/^(viel|viele|reichlich)$/, 1.5]];
  const SLOT_W = [[/^(frühstück|fruehstueck|morgens|frühstücken)$/, 'frueh'], [/^(mittag|mittagessen|lunch|mittags)$/, 'mittag'], [/^(abendessen|abendbrot|abends|dinner|abend)$/, 'abend'], [/^(snack|snacks|zwischendurch|nachmittags|nachtisch|dessert)$/, 'snack']];
  const STOP = new Set(['und', 'mit', 'dazu', 'noch', 'von', 'vom', 'der', 'die', 'das', 'den', 'dem', 'des', 'aus', 'zum', 'zur', 'auf', 'als', 'in', 'im', 'ca', 'circa', 'etwa', 'ungefähr', 'so',
    'gegessen', 'getrunken', 'hatte', 'habe', 'hab', 'ich', 'heute', 'gestern', 'frisch', 'frische', 'frischer', 'frisches', 'selbstgemacht', 'selbst', 'gemacht', 'pur', 'lecker', 'leckere', 'bio',
    'normal', 'normale', 'normaler', 'mittel', 'mittlere', 'mittlerer', 'mittleres', 'je', 'jeweils', 'zusammen', 'insgesamt', 'oder', 'bzw', 'x', 'mal',
    'gekocht', 'gekochte', 'gekochter', 'gekochtes', 'gekochten', 'gebraten', 'gebratene', 'gebratener', 'gebratenes', 'gebratenen', 'gegrillt', 'gegrillte', 'gegrillter', 'gegrilltes', 'gegrillten',
    'gedünstet', 'gedünstete', 'gedünstetes', 'gebacken', 'gebackene', 'gebackener', 'überbacken', 'überbackene', 'roh', 'rohe', 'roher', 'rohes', 'gedämpft', 'gedämpfte', 'frittiert', 'frittierte',
    'paniert', 'panierte', 'geröstet', 'geröstete', 'warm', 'warme', 'warmer', 'warmes', 'kalt', 'kalte', 'kalter', 'kaltes', 'heiss', 'heisse', 'heisser', 'heisses', 'scharf', 'scharfe',
    'mein', 'meine', 'meinen', 'meinem', 'unser', 'unsere', 'omas', 'mamas', 'papas', 'mager', 'magere', 'vegan', 'vegane', 'veganer', 'veganes', 'vegetarisch', 'vegetarische', 'hausgemacht', 'hausgemachte', 'fettarm', 'fettarme', 'fettarmer', 'light', 'leicht', 'leichte', 'stück', 'stücke']);

  // ---------- Index ----------
  function parseUnits(s) {
    const u = {};
    String(s || '').split(',').filter(Boolean).forEach(p => { const [k, v] = p.split(':'); u[k] = +v; });
    return u;
  }
  function makeFood(key, names, per, dp, units, cat, fl, own) {
    // "~Name": a word that is also an adjective ("helles Brötchen", "klare Brühe", "Espresso Shot"); it names this
    // food only when nothing else is in the phrase (2.15)
    const alone = new Set(names.filter(n => n[0] === '~').map(n => norm(n.slice(1))));
    names = names.map(n => n.replace(/^~/, ''));
    const syn = names.map(n => norm(n)).filter(Boolean);
    return { key, n: names[0], syn, orig: names, kcal: per[0], p: per[1], c: per[2], f: per[3], fib: per[4], dp, u: units, cat, fl: fl || '', own: !!own, alone };
  }
  const BASE = T.map(r => makeFood('f:' + norm(r[0].split('|')[0]).replace(/\s+/g, '_'), r[0].split('|'), [r[1], r[2], r[3], r[4], r[5]], r[6], parseUnits(r[7]), r[8], r[9]));
  function buildIndex(foods) {
    const first = new Map(), single = [];
    for (const f of foods) {
      f.syn.forEach((s, si) => {
        const toks = s.split(' '), st = toks.map(stem);
        const e = { f, toks: st, raw: s, n: toks.length, len: s.length, orig: f.orig[si] || f.n, alone: !!(f.alone && f.alone.has(s)) };
        if (!first.has(st[0])) first.set(st[0], []);
        first.get(st[0]).push(e);
        if (toks.length === 1) single.push(e);
      });
    }
    return { first, single };
  }
  const BASE_IDX = buildIndex(BASE);
  const SHORT_HEADS = new Set(['eis', 'tee', 'dip']);
  const RAW = new Set(['roh', 'rohe', 'roher', 'rohes', 'ungekocht', 'ungekochte', 'ungekochter', 'trocken', 'trockene', 'trockener']);
  const RAWOF = new Map();
  BASE.forEach(f => { if (/ roh$/.test(f.n)) { const b = BASE.find(x => x.n === f.n.replace(/ roh$/, '')); if (b) RAWOF.set(b.key, f); } });
  const byKey = new Map(BASE.map(f => [f.key, f]));
  function customFoods(list) {
    return (list || []).filter(x => x && x.name).map(x => makeFood('c:' + x.id, [x.name].concat(String(x.alias || '').split(',').map(a => a.trim()).filter(Boolean)),
      [+x.kcal || 0, +x.p || 0, +x.c || 0, +x.f || 0, +x.fib || 0], Math.max(1, +x.dp || 100), {}, x.cat || 'eigen', x.fl || '', true));
  }

  // ---------- Matching ----------
  function matchAt(toks, stems, i, idxs) {
    let best = null;
    const better = (a, b) => !b || a.n > b.n || (a.n === b.n && (a.len > b.len || (a.len === b.len && a.f.own && !b.f.own)));
    for (const idx of idxs) {
      for (const e of idx.first.get(stems[i]) || []) {
        if (i + e.n > toks.length) continue;
        let ok = true;
        for (let k = 1; k < e.n; k++) if (stems[i + k] !== e.toks[k]) { ok = false; break; }
        if (ok) { const m = { f: e.f, n: e.n, len: e.len, used: e.n, syn: e.orig, alone: e.alone }; if (better(m, best)) best = m; }
      }
      // Written apart: "hähnchen brust", "protein shake"
      if (i + 1 < toks.length) {
        const joined = stem(toks[i] + toks[i + 1]);
        for (const e of idx.first.get(joined) || []) if (e.n === 1) { const m = { f: e.f, n: 2, len: e.len, used: 2, syn: e.orig, alone: e.alone }; if (better(m, best)) best = m; }
      }
    }
    if (best) return best;
    // German compounds: the last part names the food ("erdbeerjoghurt", "kräutertee", "vollkornnudeln")
    const t = toks[i], ts = stems[i];
    let suf = null;
    // The front part needs three letters, and a last part of three letters counts only for a few common ones
    // (SHORT_HEADS); otherwise "weiß" became ice cream and "Marzipan" an IPA (2.14).
    for (const idx of idxs) for (const e of idx.single) {
      if (e.len < 3 && e.raw !== 'öl') continue;
      if (e.len === 3 && !SHORT_HEADS.has(e.raw)) continue;
      // "Götterspeise", "Nachspeise", "Quarkspeise" end in "speise", not in ice cream (2.15)
      if (e.raw === 'eis' && (/speise?$/.test(t) || /speis$/.test(ts))) continue;
      if ((t.length - e.len >= 3 && t.endsWith(e.raw)) || (ts.length - e.len >= 3 && ts.endsWith(e.raw)) || (ts.length - e.toks[0].length >= 3 && e.toks[0].length >= 3 && ts.endsWith(e.toks[0]))) {
        if (!suf || e.len > suf.len || (e.len === suf.len && e.f.own && !suf.f.own)) suf = { f: e.f, n: 1, len: e.len, used: 1, compound: true, alone: e.alone, syn: t[0].toUpperCase() + t.slice(1) };
      }
    }
    if (suf || t.length < 5 || /\d/.test(t)) return suf;
    // Typing errors: one letter off ("bannane", "joghurth"), two for long words
    let fz = null;
    for (const idx of idxs) for (const e of idx.single) {
      if (e.len < 5 || Math.abs(e.len - t.length) > 2) continue;
      // A typing error never turns a word into alcohol ("Sprite" is no Spritz): it would distort the patterns and
      // the experiment without alcohol; an unknown word stays visible instead (2.14)
      if (e.f.fl.includes('a')) continue;
      const d = dist(t, e.raw, t.length >= 9 ? 2 : 1);
      if (d >= 0 && (!fz || d < fz.d || (d === fz.d && e.f.own && !fz.f.own))) fz = { f: e.f, n: 1, len: e.len, used: 1, compound: true, fuzzy: true, d, syn: e.orig };
    }
    return fz;
  }
  // Edit distance with an upper bound (-1 when larger)
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return -1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let low = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < low) low = cur[j]; }
      if (low > max) return -1;
      prev = cur;
    }
    return prev[b.length] <= max ? prev[b.length] : -1;
  }
  function numOf(t) {
    if (FRAC[t] != null) return FRAC[t];
    let m = /^(\d+)[.,](\d+)$/.exec(t); if (m) return +(m[1] + '.' + m[2]);
    m = /^(\d+)\/(\d+)$/.exec(t); if (m && +m[2]) return +m[1] / +m[2];
    m = /^(\d+)-(\d+)$/.exec(t); if (m) return (+m[1] + +m[2]) / 2;
    if (/^\d+$/.test(t)) return +t;
    if (NUMW[t] != null) return NUMW[t];
    return null;
  }
  const unitOf = t => { if (MASS[t] != null) return t; for (const [re, u] of UNIT_W) if (re.test(t)) return u; return null; };
  // Splits glued forms: "200g" -> "200 g", "2x" -> "2 x", "0,5l" -> "0,5 l"
  function tokenize(s) {
    const out = [];
    for (const w of s.split(' ')) {
      if (!w) continue;
      const m = /^(\d+(?:[.,]\d+)?|[½¼¾⅓⅔])([a-zäöü]+)$/.exec(w);
      if (m && (unitOf(m[2]) || m[2] === 'x')) { out.push(m[1], m[2]); continue; }
      const x = /^x(\d+)$/.exec(w); if (x) { out.push('x', x[1]); continue; }
      const p = /^(\d+)(?:[.,]\d+)?%$/.exec(w); if (p) { out.push('%' + p[1]); continue; }
      out.push(w);
    }
    return out;
  }

  // One piece of text ("2 eier", "skyr 250 g") into food hits with amounts and leftovers
  // "alkoholfreier Sekt", "Radler alkoholfrei", "Virgin Mojito", "Bier 0,0": the drink without alcohol. Before 2.15
  // "alkoholfreier" became an alcohol-free beer and "Sekt" stayed alcohol, so both were logged.
  const AF = /\balkoholfrei|\bohne alkohol\b|\bvirgin\b|(?<![\d.,])0[.,]0(?![\d.,])/;
  const AF_G = /\balkoholfrei\w*|\bohne alkohol\b|\bvirgin\b|(?<![\d.,])0[.,]0(?![\d.,])\s*%?/g;
  const AF_OF = { 'f:bier': 'f:alkoholfreies_bier', 'f:radler': 'f:alkoholfreies_bier', 'f:wein': 'f:alkoholfreier_wein', 'f:weinschorle': 'f:alkoholfreier_wein',
    'f:glühwein': 'f:kinderpunsch', 'f:apfelwein': 'f:apfelschorle', 'f:schnaps': 'f:wasser' };
  const isAlc = h => h.f.fl.includes('a');
  function scan(text, idxs, af) {
    const r = scanText(text, idxs);
    if (!r.hits.some(isAlc) || !(af || AF.test(text))) return r;
    const r2 = scanText(text.replace(AF_G, ' '), idxs);
    r2.hits.forEach(h => { if (isAlc(h)) { h.f = byKey.get(AF_OF[h.f.key] || 'f:alkoholfreier_cocktail'); h.syn = h.syn + ' alkoholfrei'; } });
    return r2;
  }
  function scanText(text, idxs) {
    const toks = tokenize(text).filter(t => !/^%/.test(t)), stems = toks.map(stem);
    const hits = [], unknown = [];
    let qty = null, unit = null, size = 1, slot = null, pend = [], mult = null;
    const flush = () => { if (pend.length) { unknown.push(pend.join(' ')); pend = []; } };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const n = numOf(t);
      // A name that starts with a number word counts as the name: "ein halbes Hähnchen" (2.15)
      const mn = n != null && NUMW[t] != null ? matchAt(toks, stems, i, idxs) : null;
      if (n != null && !(mn && !mn.compound && mn.n > 1)) {
        // "ein halbes", "ein paar": the second word wins
        if (t === 'paar') qty = null;
        else if (qty === 1 && NUMW[toks[i - 1]] === 1 && NUMW[t] != null) qty = n;
        else qty = n;
        flush(); continue;
      }
      if (t === 'x' || t === '×') { if (qty != null) { mult = qty; qty = null; } flush(); continue; }
      const u = unitOf(t);
      const m = matchAt(toks, stems, i, idxs);
      // A word that is also an adjective names a drink only on its own: "ein Helles" is beer, "helles Brötchen",
      // "klare Brühe" or "Espresso Shot" are not; before 2.15 they counted as alcohol. After an unknown word
      // ("Spirulina Shot") it stays unknown with it.
      if (m && m.alone) {
        if (pend.length) { pend.push(t); continue; }
        if (hits.length || toks.slice(i + m.used).some((x, k) => matchAt(toks, stems, i + m.used + k, idxs))) continue;
      }
      if (u && !(m && !m.compound && m.n > 1)) {
        // A unit word that is also a food ("riegel") counts as food when nothing else follows
        const rest = toks.slice(i + 1).some((x, k) => matchAt(toks, stems, i + 1 + k, idxs));
        if (!(m && !rest && !MASS[t])) {
          const last = hits[hits.length - 1];
          // Amount after the food: "skyr 250 g"
          if (qty != null && last && last.qty == null && !last.unit && !rest) { last.qty = qty; last.unit = u; qty = null; }
          else unit = u;
          flush(); continue;
        }
      }
      if (m) {
        flush();
        if (mult != null && qty == null) { qty = mult; mult = null; }
        hits.push({ f: m.f, syn: m.syn, fuzzy: !!m.fuzzy, qty, unit, size, mult, pos: i });
        qty = null; unit = null; size = 1; mult = null;
        i += m.used - 1; continue;
      }
      const sz = SIZE.find(([re]) => re.test(t)); if (sz) { size *= sz[1]; continue; }
      const sl = SLOT_W.find(([re]) => re.test(t)); if (sl) { slot = sl[1]; flush(); continue; }
      if (STOP.has(t)) { flush(); continue; }
      if (/^[\d.,]+$/.test(t)) continue;
      pend.push(t);
    }
    flush();
    if (toks.some(t => RAW.has(t))) hits.forEach(h => { const r = RAWOF.get(h.f.key); if (r) { h.f = r; h.syn = r.n; } });
    // Trailing amount without a food: belongs to the last food ("eier 3", "skyr, 150 g")
    const last = hits[hits.length - 1];
    let loose = null;
    if (qty != null || unit) {
      if (last && last.qty == null && !last.unit) { last.qty = qty; last.unit = unit; last.size *= size; }
      else loose = { qty, unit, size };
    }
    return { hits, unknown: unknown.filter(u => u.replace(/[^a-zäöü]/g, '').length >= 3), slot, loose };
  }

  // Which unit name fits a gram value best ("1 Scheibe", "2 Flaschen")
  function unitFor(f, per) {
    const liquid = f.fl.includes('d');
    const order = liquid ? (f.fl.includes('h') ? ['ta', 'gl', 'be', 'fl', 'do'] : ['gl', 'fl', 'do', 'be', 'ta']) : ['sch', 'st', 'be', 'do', 'pk', 'ri', 'ku', 'po', 'tl', 'el'];
    return order.find(k => f.u[k] === per) || null;
  }
  function sideG(f, head) {
    if (head && head.fl.includes('h') && f.u.h) return f.u.h;
    return f.u.s != null ? f.u.s : Math.round(f.dp * 0.5);
  }
  function gramsOf(h, ctx, side, head) {
    const f = h.f, qty = h.qty, u = h.unit;
    let g, amt, def = false;
    const liquid = f.fl.includes('d');
    if (u && MASS[u] != null) { g = (qty == null ? 1 : qty) * MASS[u]; amt = null; }
    else if (u) {
      const per = f.u[u] != null ? f.u[u] : (u === 'st' || u === 'po') ? (ctx.portions[f.key] || f.dp) : UNIT_G[u];
      const q = qty == null ? 1 : qty;
      g = q * per; amt = fmtQ(q) + ' ' + UNIT_LBL[u][q > 1 ? 1 : 0];
    } else if (qty != null) {
      const per = f.u.x != null ? f.u.x : f.u.st != null ? f.u.st : null;
      if (per == null && qty >= 20) { g = qty; amt = null; }
      else {
        const p2 = per != null ? per : (ctx.portions[f.key] || f.dp);
        g = qty * p2;
        const lu = unitFor(f, p2) || (per != null ? 'st' : 'po');
        amt = fmtQ(qty) + ' ' + UNIT_LBL[lu][qty > 1 ? 1 : 0];
      }
    } else if (side) { g = sideG(f, head); amt = null; }
    else {
      g = ctx.portions[f.key] || f.dp; def = true;
      const lu = unitFor(f, g);
      amt = ctx.portions[f.key] ? 'deine Portion' : '1 ' + UNIT_LBL[lu || 'po'][0];
    }
    if (h.mult) { g *= h.mult; amt = (h.mult !== 1 ? fmtQ(h.mult) + ' × ' : '') + (amt || ''); def = false; }
    if (h.size !== 1) { g *= h.size; amt = (h.size > 1 ? 'groß, ' : 'klein, ') + (amt || ''); def = false; }
    g = Math.max(1, Math.round(g));
    const unitTxt = liquid ? ' ml' : ' g';
    amt = amt ? amt.replace(/, $/, '') + ' (' + g + unitTxt + ')' : g + unitTxt;
    return { g, amt, def };
  }
  function itemOf(f, g, amt, def, side, syn) {
    const k = g / 100;
    return { key: f.key, name: syn || f.n, g, amt, def, side: !!side, kcal: Math.round(f.kcal * k), p: r1(f.p * k), c: r1(f.c * k), f: r1(f.f * k), fib: r1(f.fib * k), cat: f.cat, fl: f.fl,
      cups: f.fl.includes('k') ? Math.max(1, Math.round(g / (f.u.ta || f.dp))) : 0, src: f.own ? 'eigen' : 'db' };
  }
  const QUICK_P = /^(\d+(?:[.,]\d+)?)\s*(g|gramm)?\s*(eiweiss|protein|eiweis)$/;

  // ---------- Parse ----------
  // ctx: { foods: custom foods (raw), portions: { key: g }, meals: [{ id, name, items }] }
  function parse(text, ctx) {
    ctx = ctx || {};
    const C = { portions: ctx.portions || {} };
    const own = customFoods(ctx.foods);
    const idxs = own.length ? [buildIndex(own), BASE_IDX] : [BASE_IDX];
    const s = norm(String(text || '').replace(/([a-zäöüß]),(\d)/gi, '$1, $2').replace(/\s+&\s+|\s*\+\s*(?!\d)|;|\n/g, ',')
      .replace(/(\d+(?:[.,]\d+)?)\s*%(?:\s*fett)?/g, (m, n) => (+n.replace(',', '.') <= 2 ? ' fettarm ' : ' ')));
    const items = [], unknown = [];
    let slot = null;
    const s2 = s.replace(/\b(rührei|rühreier|omelett|omelette)\s+(?:aus|von|mit)\s+(\S+)\s+eier(?:n)?\b/g, (m, dish, q) => { const n = numOf(q); return n ? dish + ' ' + Math.round(n * 65) + ' g' : m; });
    const segs = s2.split(/,(?!\d)/).map(x => x.trim()).filter(Boolean);
    const inner = x => x.split(/\s+(?:und|sowie|plus|dazu)\s+/i).map(y => y.trim()).filter(Boolean);
    // The same pieces in the user's own spelling, for labels such as "2 Scheiben Vollkornbrot mit Butter"
    const raw = String(text || '').replace(/([a-zäöüß]),(\d)/gi, '$1, $2').replace(/\s+&\s+|\s*\+\s*(?!\d)|;|\n/g, ',').split(/,(?!\d)/).map(x => x.trim()).filter(Boolean).flatMap(inner);
    const flat = segs.flatMap(inner);
    const label = k => { const r = (raw.length === flat.length ? raw[k] : flat[k]).replace(/\s+/g, ' ').replace(/^\+\s*/, ''); return r ? r[0].toUpperCase() + r.slice(1) : r; };
    let k = -1;
    for (const seg0 of segs) {
      for (const seg of inner(seg0)) {
        k++;
        const n0 = items.length;
        // Saved meal by name
        const meal = (ctx.meals || []).find(m => norm(m.name) === seg.replace(/^(\d+|eine?|einen)\s+/, ''));
        if (meal) { meal.items.forEach(it => items.push(Object.assign({}, it, { src: 'mahlzeit', meal: meal.name, seg: meal.name, def: false, side: false }))); continue; }
        const q = QUICK_P.exec(seg.replace(/^\+\s*/, ''));
        if (q) { const p = +q[1].replace(',', '.'); items.push({ key: 'eiweiss', name: 'Eiweiß, geschätzt', g: 0, amt: fmtQ(p) + ' g Eiweiß', kcal: null, p: r1(p), c: null, f: null, fib: null, cat: 'protein', fl: '', cups: 0, src: 'schnell', def: false, side: false }); continue; }
        // "x mit y": y is a side, unless the whole phrase is one food ("proteinshake mit milch")
        const af = AF.test(raw.length === flat.length ? raw[k].toLowerCase() : seg);
        const whole = / mit /.test(seg) ? scan(seg, idxs, af) : null;
        const parts = whole && whole.hits.length === 1 && !whole.unknown.length ? [seg] : seg.split(/\s+mit\s+/);
        let head = null;
        parts.forEach((part, pi) => {
          const r = parts.length === 1 && whole ? whole : scan(part, idxs, af);
          if (r.slot) slot = r.slot;
          r.unknown.forEach(u => unknown.push(u));
          if (!r.hits.length && r.loose && items.length) {
            // "skyr, 150 g": an amount on its own belongs to the food before it
            const prev = items[items.length - 1], f = byKey.get(prev.key) || own.find(o => o.key === prev.key);
            if (f && prev.def) { const gr = gramsOf({ f, qty: r.loose.qty, unit: r.loose.unit, size: r.loose.size, mult: null }, C, false, null); items[items.length - 1] = itemOf(f, gr.g, gr.amt, gr.def, false, prev.name); }
          }
          r.hits.forEach((h, hi) => {
            const isSide = pi > 0;
            const gr = gramsOf(h, C, isSide, head);
            const it = itemOf(h.f, gr.g, gr.amt, gr.def, isSide, h.syn);
            if (h.fuzzy) it.fuzzy = true;
            if (pi === 0 && hi === 0) head = h.f;
            if (h.f.fl.includes('i')) { it.skip = true; }
            items.push(it);
          });
        });
        for (let j = n0; j < items.length; j++) if (!items[j].seg) items[j].seg = label(k);
      }
    }
    return { items: items.filter(i => !i.skip), unknown, slot };
  }

  // ---------- Day helpers ----------
  const SLOTS = [['frueh', 'Frühstück', '08:00'], ['mittag', 'Mittag', '12:30'], ['snack', 'Snack', '16:00'], ['abend', 'Abend', '19:00']];
  const SLOT_NAME = Object.fromEntries(SLOTS.map(s => [s[0], s[1]]));
  const SLOT_TIME = Object.fromEntries(SLOTS.map(s => [s[0], s[2]]));
  function slotAt(hm) { return hm < '10:30' ? 'frueh' : hm < '15:00' ? 'mittag' : hm < '17:30' ? 'snack' : hm < '22:30' ? 'abend' : 'snack'; }
  function totals(list) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, inc: false, fv: 0, water: 0, n: 0, slot: { frueh: 0, mittag: 0, snack: 0, abend: 0 }, kslot: { frueh: 0, mittag: 0, snack: 0, abend: 0 } };
    for (const e of list || []) {
      t.n++;
      if (e.kcal == null) t.inc = true; else t.kcal += e.kcal;
      t.p += e.p || 0; t.c += e.c || 0; t.f += e.f || 0; t.fib += e.fib || 0;
      if (e.cat === 'gem' || e.cat === 'obst') t.fv += e.g || 0;
      if ((e.fl || '').includes('w')) t.water += e.g || 0;
      if (t.slot[e.slot] != null) { t.slot[e.slot] += e.p || 0; t.kslot[e.slot] += e.kcal || 0; }
    }
    ['p', 'c', 'f', 'fib'].forEach(k => { t[k] = r1(t[k]); });
    t.fvPortions = Math.round(t.fv / 110 * 2) / 2;
    return t;
  }
  // Factors for the health patterns, derived from what was eaten that day (only when the log looks complete enough)
  function factors(list) {
    const out = {};
    if (!list || !list.length) return out;
    const cups = list.reduce((s, e) => s + (e.cups || 0), 0);
    if (cups) out.kaffee = Math.min(5, cups);
    if (list.some(e => (e.fl || '').includes('a'))) out.alkohol = true;
    if (list.some(e => (e.fl || '').includes('z'))) out.knoblauch = true;
    const meals = list.filter(e => (e.kcal || 0) >= 100 && e.time).map(e => e.time).sort();
    if (meals.some(t => t >= '21:00')) out.spaet = true;
    const kcal = list.reduce((s, e) => s + (e.kcal || 0), 0);
    if (meals.length >= 3 || kcal >= 1200) {
      const day = meals.filter(t => t >= '06:00' && t <= '21:30');
      const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
      let gap = 0; for (let i = 1; i < day.length; i++) gap = Math.max(gap, toMin(day[i]) - toMin(day[i - 1]));
      if (gap >= 420 || (day.length && day[0] >= '11:30')) out.nuechtern = true;
    }
    const drinks = list.filter(e => (e.fl || '').includes('w'));
    if (drinks.length >= 2) out.wasser = Math.round(drinks.reduce((s, e) => s + (e.g || 0), 0) / 500) / 2;
    return out;
  }
  // Scales an entry to new grams (protein-only entries keep their values)
  function scale(e, g) {
    if (!e.g || !g) return e;
    const k = g / e.g;
    return Object.assign({}, e, { g: Math.round(g), kcal: e.kcal == null ? null : Math.round(e.kcal * k), p: r1(e.p * k), c: e.c == null ? null : r1(e.c * k), f: e.f == null ? null : r1(e.f * k), fib: e.fib == null ? null : r1(e.fib * k), cups: e.cups ? Math.max(1, Math.round(e.cups * k)) : 0 });
  }

  const api = { T, BASE, parse, norm, stem, totals, factors, scale, slotAt, SLOTS, SLOT_NAME, SLOT_TIME, food: key => byKey.get(key) || null, count: T.length };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Food = api;
})(typeof window !== 'undefined' ? window : globalThis);
