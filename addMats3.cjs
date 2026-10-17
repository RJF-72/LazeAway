const fs=require('fs');
let m = JSON.parse(fs.readFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json')).materials;
function add(id,name,cat,th,op,pwr,spd,ps,z,foc,intv,dpi,kerf,air,notes,clr,coat){
  m.push({id,name,category:cat,thickness_mm:th,operation:op,power_percent:pwr,speed_mm_min:spd,passes:ps,z_step_per_pass_mm:z,focus_distance_mm:foc,interval_mm:intv,dpi,kerf_mm:kerf,air_assist:air,notes,color:clr,coating_required:coat});
}
// Leather
add('leather_genuine_1_5mm_cut','Genuine Leather 1.5mm CUT','Leather',1.5,'CUT',100,280,3,0.5,28,0.0847,300,0.13,false,'Ventilate!','brown',false);
add('leather_faux_1_5mm_cut','Faux Leather 1.5mm CUT','Leather',1.5,'CUT',100,300,3,0.5,28,0.0847,300,0.13,false,'Toxic fumes - ventilate!','brown',false);
add('leather_engrave','Leather ENGRAVE','Leather',1.5,'ENGRAVE',25,3000,1,0,28,0.08,300,0,'','Clean engrave','brown',false);
// Paper/Cardboard/Fabric
add('cardboard_2mm_cut','Cardboard 2mm CUT','Paper/Fabric',2,'CUT',100,500,2,0,28,0.0847,300,0.1,false,'Fire risk - watch it!','brown',false);
add('kraft_paper_cut','Kraft Paper CUT','Paper/Fabric',0.5,'CUT',60,800,1,0,28,0.0847,300,0.05,false,'Cut quickly','brown',false);
add('cotton_fabric_cut','Cotton Fabric CUT','Paper/Fabric',0.3,'CUT',70,600,1,0,28,0.0847,300,0.05,false,'May fray','',false);
add('denim_cut','Denim CUT','Paper/Fabric',1,'CUT',100,300,2,0.5,28,0.0847,300,0.12,false,'Thick fabric','blue',false);
add('felt_2mm_cut','Felt 2mm CUT','Paper/Fabric',2,'CUT',80,400,2,0.5,28,0.0847,300,0.1,false,'Clean cut','',false);
add('felt_engrave','Felt ENGRAVE','Paper/Fabric',2,'ENGRAVE',20,3000,1,0,28,0.08,300,0,'','Light engrave','',false);
// Coated metals / Anodized / Painted
add('anodized_aluminum_mark','Anodized Aluminum MARK','Metal',1,'ENGRAVE',100,200,1,0,26,0.0847,300,0,'','Removes anodize layer - very accurate. No deep cut.','silver',false);
add('painted_metal_mark','Painted Metal MARK','Metal',1,'ENGRAVE',90,300,1,0,26,0.0847,300,0,'','Removes paint - no metal cut','',false);
add('stainless_black_paint_mark','Stainless Steel (black spray paint) MARK','Metal',1,'ENGRAVE',100,150,1,0,26,0.0847,300,0,'','6W diode cannot cut bare stainless without coating. This is marking only.','silver',true);
add('powder_coated_tumbler_mark','Powder Coated Tumbler MARK','Metal',1,'ENGRAVE',100,250,1,0,26,0.08,300,0,'','Cylindrical marking - interval 0.08','',false);
// Glass/Ceramic/Tile
add('glass_black_paint_engrave','Glass with Black Paint ENGRAVE','Glass/Ceramic',3,'ENGRAVE',100,300,1,0,28,0.08,300,0,'','Paint, engrave, wash off. No bare glass cutting on 6W diode.','clear',true);
add('white_tile_black_paint_engrave','White Tile (black paint) ENGRAVE','Glass/Ceramic',6,'ENGRAVE',100,250,1,0,28,0.06,400,0,'','Norton White Tile method - extremely accurate. Coating required for bare tile.','white',true);
add('ceramic_tile_mark','Ceramic Tile MARK (coated)','Glass/Ceramic',6,'ENGRAVE',100,250,1,0,28,0.06,400,0,'','Same as white tile - coating required.','',true);
fs.writeFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json',JSON.stringify({materials:m},null,2));
console.log(m.length);
