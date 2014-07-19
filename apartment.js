"use strict"

function Apartment(id, position, yaw, height) {

    this.textures = [];
    
    this.shaderProgram = glu.createShader(  document.getElementById("shader-vs").text, 
                                            document.getElementById("texture-shader-fs").text,
                                            ["vertexPosition", "vertexTexCoords"],
                                            ["modelViewProjectionMatrix", "tex"]);

    this.layoutId = id;
    this.layoutRequest = new XMLHttpRequest();
    this.layoutRequest.open("GET", "http://localhost:1080/rest/get/layoutMetadata/" + id);
    this.layoutRequest.responseType = "json";
    //this.layoutRequest.apartment = this;
    var aptTmp = this;
    this.layoutRequest.onreadystatechange = function() 
    { 
        if (this.readyState != 4)
        return;

        if (this.response == null)
            return;

        var tmp = aptTmp.loadLayout(this, position, yaw, height); 
        aptTmp.processLayout(tmp);
    }
    
    this.layoutRequest.send();
}

Apartment.prototype.render = function(modelViewMatrix, projectionMatrix)
{
    if (!this.vertices)
        return;
        
    var mvpMatrix = mat4.create();
    mat4.mul(mvpMatrix, projectionMatrix, modelViewMatrix);

	gl.useProgram(this.shaderProgram);   //    Install the program as part of the current rendering state
	gl.uniformMatrix4fv(this.shaderProgram.locations.modelViewProjectionMatrix, false, mvpMatrix);

	gl.enableVertexAttribArray(this.shaderProgram.locations.vertexPos); // setup vertex coordinate buffer
	gl.enableVertexAttribArray(this.shaderProgram.locations.vertexTexCoords); //setup texcoord buffer
    gl.uniform1i(this.shaderProgram.locations.tex, 0); //select texture unit 0 as the source for the shader variable "tex" 

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);   //select the vertex buffer as the currrently active ARRAY_BUFFER (for subsequent calls)
	gl.vertexAttribPointer(this.shaderProgram.locations.vertexPos, 3, gl.FLOAT, false, 0, 0);  //assigns array "vertices" bound above as the vertex attribute "vertexPosition"
    
	gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoords);
	gl.vertexAttribPointer(this.shaderProgram.locations.vertexTexCoords, 2, gl.FLOAT, false, 0, 0);  //assigns array "texCoords" bound above as the vertex attribute "vertexTexCoords"

    
	for (var i = 0; i < this.numVertices; i+=6)
	{
        gl.activeTexture(gl.TEXTURE0);				
        gl.bindTexture(gl.TEXTURE_2D, this.textures[i/6]);
	    gl.drawArrays(gl.TRIANGLES, i, 6);
    }
	gl.flush();
}
			
			
Apartment.prototype.handleLoadedTexture = function(image) {
    this.textures[ image.id] = glu.createTexture( image );
    if (Controller.onRequestFrameRender)
        Controller.onRequestFrameRender();
}

/* scoping hack: needs to be a dedicated function, because it is
 *               called within a loop over j. Without a dedicated function,
 *               the 'texture' and "j" variable would be shared between all 
 *               loop iterations, leading to the same texture being loaded 
 *               over and over again */
Apartment.prototype.requestTexture = function(layoutId, textureId)
{
    var image = new Image();
    image.id = textureId;
    image.apartment = this;

    image.onload = function() {
      this.apartment.handleLoadedTexture(image)
    }

    /*image.src = "tiles/tile_"+j+".png"; */
    image.crossOrigin = "anonymous";
    image.src = "http://localhost:1080/rest/get/texture/"+layoutId+"/"+textureId;
}
			
/**
 *  creates the 3D GL geometry scene.
 */
Apartment.prototype.processLayout = function(segments)
{
    this.vertices = [];
    this.texCoords= [];
    for (var i in segments)
    {
        var seg = segments[i];
        /* D-C   
         * |/|
         * A-B  */
        var A = segments[i].pos;
        var w = segments[i].width;
        var B = [A[0]+w[0], A[1]+w[1], A[2]+w[2]];
        var h = segments[i].height;
        var C = [B[0]+h[0], B[1]+h[1], B[2]+h[2]];
        var D = [A[0]+h[0], A[1]+h[1], A[2]+h[2]];
        
        var verts = [].concat(A, B, C, /**/ A, C, D);
        [].push.apply(this.vertices, verts);
        
        var coords = [].concat([0,0], [1,0], [1,1], /**/ [0,0], [1,1], [0,1]);
        [].push.apply(this.texCoords, coords);
    }

    this.numVertices = (this.vertices.length / 3) | 0;
    
    this.vertices = glu.createArrayBuffer(this.vertices); //convert to webgl array buffer
    this.texCoords= glu.createArrayBuffer(this.texCoords);
    
    for (var i = 0; i < this.numVertices/6; i++) {
        this.requestTexture(this.layoutId, i);
    }
	
    //renderScene();
}
			
function getAABB( segments)
{
    if (segments.length < 1) return [];
    var min_x = segments[0].pos[0];
    var max_x = segments[0].pos[0];
    var min_y = segments[0].pos[1];
    var max_y = segments[0].pos[1];
    
    for (var i in segments)
    {
        max_x = Math.max(max_x, segments[i].pos[0]);
        min_x = Math.min(min_x, segments[i].pos[0]);
        max_y = Math.max(max_y, segments[i].pos[1]);
        min_y = Math.min(min_y, segments[i].pos[1]);
        
        var x = segments[i].pos[0] + segments[i].width[0]; //width may be negative, so pos+width can
        var y = segments[i].pos[1] + segments[i].width[1]; //be smaller or larger than pos alone

        max_x = Math.max(max_x, x);
        min_x = Math.min(min_x, x);
        max_y = Math.max(max_y, y);
        min_y = Math.min(min_y, y);
    }
    
    return {"min_x":min_x, "max_x":max_x, "min_y":min_y, "max_y":max_y};
}


Apartment.prototype.loadLayout = function(request, position, yaw, height)
{
        
    //console.log("request: %o", request);

    var segments = [];
    this.scale = request.response.scale;
    var rectangles = request.response.geometry;
    // json geometry already has the correct x/y scale, 
    // but is stored in [cm] while we need it in [m];
    var scaling = 1/100.0;  
    for (var i in rectangles)
    {
        //console.log(rectangles[i]);
        rectangles[i].pos[0] *= scaling;
        rectangles[i].pos[1] *= scaling;
        rectangles[i].pos[2] *= scaling;
        
        rectangles[i].width[0] *= scaling;
        rectangles[i].width[1] *= scaling;
        rectangles[i].width[2] *= scaling;

        rectangles[i].height[0] *= scaling;
        rectangles[i].height[1] *= scaling;
        rectangles[i].height[2] *= scaling;

        rectangles[i].pos[2] += height;
        
        segments.push(rectangles[i]);

    }
    
    //step 2: shift apartment to relocate its center to (0,0) to give its 'position' a canonical meaning
    var aabb = getAABB( segments);
    //var dx = aabb.max_x - aabb.min_x;
    //var dy = aabb.max_y - aabb.min_y;
    var mid_x = (aabb.max_x + aabb.min_x) / 2.0;
    var mid_y = (aabb.max_y + aabb.min_y) / 2.0;
    this.pixelShift = [mid_x, mid_y];

    for (var i in segments)
    {
        segments[i].pos[0] -= mid_x;
        segments[i].pos[1] -= mid_y;
    }    
    
   
    //step 3: rotate apartment;
    //console.log("apartment yaw is %s", yaw);
    for (var i in segments)
    {
        rotate( segments[i].pos, yaw);
        rotate( segments[i].width, yaw);
        rotate( segments[i].height, yaw);
    }    
    
    this.yawShift = yaw;
    
    //step 4: move to selected position
    var earthCircumference = 2 * Math.PI * (6378.1 * 1000);
    var metersPerDegreeLat = earthCircumference / 360;
    var metersPerDegreeLng = metersPerDegreeLat * Math.cos( Controller.position.lat / 180 * Math.PI);

    var dx = (position.lng - Controller.position.lng) * metersPerDegreeLng;
    var dy = (position.lat - Controller.position.lat) * metersPerDegreeLat;

    this.worldShift = [dx, dy];
    //console.log("distance to apartment: dx=%sm, dy=%sm", dx, dy);
    for (var i in segments)
    {
        //FIXME: why do those signs have to be different?
        segments[i].pos[0] += dx;
        segments[i].pos[1] -= dy;
    }    

    return segments;
}


Apartment.prototype.localToPixelCoordinates = function(localPosition)
{
    if (!mapApartment.worldShift || !mapApartment.pixelShift || mapApartment.yawShift === undefined)
        return [0,0];

    var pos = [];
    pos[0] = localPosition.x - this.worldShift[0];
    pos[1] = localPosition.y - this.worldShift[1];
    //console.log("After World Shift: %s", p1);

    pos[1] = - pos[1];

    rotate(pos, - mapApartment.yawShift);
    pos = add2(pos, mapApartment.pixelShift);
    pos[0] *= mapApartment.scale;
    pos[1] *= mapApartment.scale;

    return pos;
}

