/* Orthographic camera for a 4 x 4 x 4 board. World Z is height above the board. */
(function () {
  'use strict';
  function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
  function project(point,camera,layout) {
    var x=point[0]-1.5,y=point[1]-1.5,z=point[2]-(layout.centerZ===undefined?1.2:layout.centerZ);
    var c=Math.cos(camera.yaw),s=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
    return {x:layout.cx+layout.scale*(s*x-c*y),y:layout.cy+layout.scale*(sp*(c*x+s*y)-cp*z),depth:cp*(c*x+s*y)+sp*z};
  }
  function face(world,normal,name,camera,layout) {
    var cp=Math.cos(camera.pitch);
    var facing=normal[0]*Math.cos(camera.yaw)*cp+normal[1]*Math.sin(camera.yaw)*cp+normal[2]*Math.sin(camera.pitch);
    if(facing<=1e-7) return null;
    var points=world.map(function(p){return project(p,camera,layout);});
    return {name:name,normal:normal,world:world,points:points,depth:points.reduce(function(sum,p){return sum+p.depth;},0)/points.length};
  }
  function cubeFaces(x,y,z,camera,layout) {
    // A small gap keeps each footprint inside its ground cell. The base is exactly Z=z.
    var l=x-.47,r=x+.47,b=y-.47,f=y+.47,t=z+1;
    var definitions=[
      {name:'top',n:[0,0,1],v:[[l,b,t],[r,b,t],[r,f,t],[l,f,t]]},
      {name:'west',n:[-1,0,0],v:[[l,b,z],[l,f,z],[l,f,t],[l,b,t]]},
      {name:'east',n:[1,0,0],v:[[r,f,z],[r,b,z],[r,b,t],[r,f,t]]},
      {name:'south',n:[0,-1,0],v:[[r,b,z],[l,b,z],[l,b,t],[r,b,t]]},
      {name:'north',n:[0,1,0],v:[[l,f,z],[r,f,z],[r,f,t],[l,f,t]]}
    ];
    return definitions.map(function(d){return face(d.v,d.n,d.name,camera,layout);}).filter(function(v){return v!==null;});
  }
  window.STRATES_ORBIT={project:project,face:face,cubeFaces:cubeFaces,clamp:clamp};
})();
