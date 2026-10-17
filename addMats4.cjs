const fs=require('fs');
let m = JSON.parse(fs.readFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json')).materials;
function add(id,name,cat,th,op,pwr,spd,ps,z,foc,intv,dpi,kerf,air,notes,clr,coat){
  m.push({id,name,category:cat,thickness_mm:th,operation:op,power_percent:pwr,speed_mm_min:spd,passes:ps,z_step_per_pass_mm:z,focus_distance_mm:foc,interval_mm:intv,dpi,kerf_mm:kerf,air_assist:air,notes,color:clr,coating_required:coat});
}
// Rubber/Plastic
add('rubber_stamp_2mm_engrave','Rubber Stamp 2mm ENGRAVE','Rubber',2,'ENGRAVE',50,1000,1,0,28,0.06,300,0,'','Mirror image - reverse for stamps','',false);
add('abs_engrave','ABS ENGRAVE (only)','Plastic',3,'ENGRAVE',20,3000,1,0,28,0.08,300,0,'','DO NOT CUT ABS - toxic fumes. ENGRAVE ONLY with ventilation.','',false);
// Clear/White with warning notes explicitly
add('clear_acrylic_cut_forbidden','Clear Acrylic CUT (Not Recommended)','Acrylic',2,'CUT',0,0,0,0,27,0.0847,300,0,'','6W diode CANNOT cut clear or white acrylic without coating. ENGRAVE ONLY with black spray paint.','clear',true);
add('white_acrylic_cut_forbidden','White Acrylic CUT (Not Recommended)','Acrylic',2,'CUT',0,0,0,0,27,0.0847,300,0,'','6W diode CANNOT cut clear or white acrylic without coating. ENGRAVE ONLY with black spray paint.','white',true);
add('glass_bare_forbidden','Bare Glass CUT (Not Recommended)','Glass/Ceramic',3,'CUT',0,0,0,0,28,0.0847,300,0,'','6W diode cannot cut bare glass/bare metal/stainless without coating. ENGRAVE ONLY with coating.','clear',true);
add('bare_metal_forbidden','Bare Metal CUT (Not Recommended)','Metal',1,'CUT',0,0,0,0,26,0.0847,300,0,'','6W diode cannot cut bare metal/stainless without coating. Use marking with paint/coating only.','silver',true);
add('stainless_bare_forbidden','Bare Stainless Steel CUT (Not Recommended)','Metal',1,'CUT',0,0,0,0,26,0.0847,300,0,'','6W diode cannot cut bare stainless without coating. Use marking with paint/coating only.','silver',true);
fs.writeFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json',JSON.stringify({materials:m},null,2));
console.log(m.length);
