const fs=require('fs');
let m = JSON.parse(fs.readFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json')).materials;
function add(id,name,cat,th,op,pwr,spd,ps,z,foc,intv,dpi,kerf,air,notes,clr,coat){
  m.push({id,name,category:cat,thickness_mm:th,operation:op,power_percent:pwr,speed_mm_min:spd,passes:ps,z_step_per_pass_mm:z,focus_distance_mm:foc,interval_mm:intv,dpi,kerf_mm:kerf,air_assist:air,notes,color:clr,coating_required:coat});
}
// Wood ENGRAVE
add('basswood_engrave','Basswood ENGRAVE','Wood',3,'ENGRAVE',35,2500,1,0,28,0.08,300,0,'','Most accurate for 6W diode','',false);
add('pine_engrave','Pine ENGRAVE','Wood',3,'ENGRAVE',40,2000,1,0,28,0.09,300,0,'','Grainy - increase power if needed','',false);
add('walnut_engrave','Walnut ENGRAVE','Wood',3,'ENGRAVE',30,2500,1,0,28,0.08,300,0,'','Dark wood needs less power','',false);
// Acrylic CUT - only opaque
add('black_acrylic_2mm_cut','Black Acrylic 2mm','Acrylic',2,'CUT',100,200,4,0.4,27,0.0847,300,0.15,false,'Black absorbs well','black',false);
add('black_acrylic_3mm_cut','Black Acrylic 3mm','Acrylic',3,'CUT',100,150,6,0.3,27,0.0847,300,0.16,false,'Black absorbs well','black',false);
add('red_acrylic_2mm_cut','Red Opaque Acrylic 2mm','Acrylic',2,'CUT',100,220,4,0.4,27,0.0847,300,0.15,false,'Opaque colors can cut','red',false);
add('blue_acrylic_2mm_cut','Blue Opaque Acrylic 2mm','Acrylic',2,'CUT',100,220,4,0.4,27,0.0847,300,0.15,false,'Opaque colors can cut','blue',false);
add('green_acrylic_2mm_cut','Green Opaque Acrylic 2mm','Acrylic',2,'CUT',100,220,4,0.4,27,0.0847,300,0.15,false,'Opaque colors can cut','green',false);
// Acrylic ENGRAVE only
add('clear_acrylic_engrave_coated','Clear Acrylic ENGRAVE (coated)','Acrylic',3,'ENGRAVE',60,1500,1,0,27,0.09,300,0,'','6W diode CANNOT cut clear/white acrylic. Must use black spray paint/coating.','clear',true);
add('white_acrylic_engrave_coated','White Acrylic ENGRAVE (coated)','Acrylic',3,'ENGRAVE',60,1500,1,0,27,0.09,300,0,'','6W diode CANNOT cut clear/white acrylic. Must use black spray paint/coating.','white',true);
add('black_acrylic_engrave','Black Acrylic ENGRAVE','Acrylic',3,'ENGRAVE',25,3000,1,0,27,0.08,300,0,'','Very accurate white mark','black',false);
fs.writeFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json',JSON.stringify({materials:m},null,2));
console.log(m.length);
