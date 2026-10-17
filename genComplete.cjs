const fs=require('fs');
const m=[];
function add(id,name,cat,th,op,pwr,spd,ps,z,foc,intv,dpi,kerf,air,notes,clr,coat){
  m.push({id,name,category:cat,thickness_mm:th,operation:op,power_percent:pwr,speed_mm_min:spd,passes:ps,z_step_per_pass_mm:z,focus_distance_mm:foc,interval_mm:intv,dpi,kerf_mm:kerf,air_assist:air,notes,color:clr,coating_required:coat});
}
// Wood CUT
add('basswood_2mm_cut','Basswood 2mm','Wood',2,'CUT',100,300,4,0.5,28,0.0847,300,0.12,false,'Orange shield ON. Best accuracy for 6W diode.','',false);
add('basswood_3mm_cut','Basswood 3mm','Wood',3,'CUT',100,250,6,0.5,28,0.0847,300,0.15,false,'Orange shield ON. Basswood is best for accuracy.','',false);
add('basswood_5mm_cut','Basswood 5mm','Wood',5,'CUT',100,180,12,0.4,28,0.0847,300,0.18,false,'Slow + many passes','',false);
add('balsa_2mm_cut','Balsa 2mm','Wood',2,'CUT',100,400,2,0.5,28,0.0847,300,0.1,false,'Very soft','',false);
add('balsa_3mm_cut','Balsa 3mm','Wood',3,'CUT',100,350,3,0.5,28,0.0847,300,0.12,false,'Very soft','',false);
add('spruce_pine_3mm_cut_texas','Spruce / Pine 3mm (Texas Guitar)','Wood',3,'CUT',100,250,10,0.3,27,0.0847,300,0.16,false,'Texas guitar soundhole default - slower + many passes to avoid stuck bug. Anti-stutter safe.','',false);
add('plywood_basswood_3mm_cut','Plywood 3mm (Basswood ply)','Wood',3,'CUT',100,200,8,0.4,28,0.0847,300,0.18,false,'Tends to delaminate','',false);
add('plywood_5mm_cut','Plywood 5mm','Wood',5,'CUT',100,150,15,0.3,28,0.0847,300,0.2,false,'Not recommended - will char','',false);
add('mdf_3mm_cut','MDF 3mm','Wood',3,'CUT',100,180,10,0.3,28,0.0847,300,0.2,false,'Dusty, ventilate well','',false);
add('cherry_3mm_cut','Cherry 3mm','Wood',3,'CUT',100,200,8,0.4,28,0.0847,300,0.17,false,'Good results','',false);
add('walnut_3mm_cut','Walnut 3mm','Wood',3,'CUT',100,180,10,0.4,28,0.0847,300,0.18,false,'Dark wood - beautiful results','',false);
add('bamboo_3mm_cut','Bamboo 3mm','Wood',3,'CUT',100,200,9,0.4,28,0.0847,300,0.17,false,'Dense, handle with care','',false);
add('oak_3mm_cut','Oak 3mm','Wood',3,'CUT',100,160,12,0.3,28,0.0847,300,0.2,false,'Hard - burns easily, go slow','',false);
fs.writeFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json',JSON.stringify({materials:m},null,2));
console.log(m.length);
