const fs=require('fs');
const m=[];
m.push({id:'basswood_2mm_cut',name:'Basswood 2mm',category:'Wood',thickness_mm:2,operation:'CUT',power_percent:100,speed_mm_min:300,passes:4,z_step_per_pass_mm:0.5,focus_distance_mm:28,interval_mm:0.0847,dpi:300,kerf_mm:0.12,air_assist:false,notes:'Orange shield ON',color:'',coating_required:false});
fs.writeFileSync('C:/Users/flana/LazeAway/src/materials/materialLibrary.json',JSON.stringify({materials:m},null,2));
console.log('ok');
