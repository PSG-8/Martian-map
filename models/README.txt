REAL NASA 3D MODELS (optional)

The site draws its own rover and astronaut from code. To use real NASA models instead:
1. Download a glTF/GLB model from NASA 3D Resources (https://science.nasa.gov/3d-resources/)
   or NASA Eyes on the Solar System. Check the license of each model and credit NASA.
2. Put the .glb file(s) in this folder and create models/models.json, for example:

   {
     "rover":     { "file": "perseverance.glb", "targetLength": 3.2, "rotYDeg": 0 },
     "astronaut": { "file": "astronaut.glb",    "targetLength": 2.0, "rotYDeg": 0 }
   }

   targetLength = size on the map (about 3 for a rover). rotYDeg turns the model so it faces
   the +x direction (try 90, 180 or -90 if it drives sideways or backwards).
Keys you can use: rover, crewed, astronaut. Without models.json nothing changes.
