#!/bin/bash

java -jar ~/Downloads/ClosureCompiler/compiler.jar --js_output_file combined.js -O SIMPLE \
    apartment.js    \
    apartmentMap.js \
    collisionHandling.js \
    buildingsStatic.js    \
    controller.js   \
    gl-matrix.js    \
    glu.js          \
    jquery.js       \
    jquery-ui.js    \
    main.js         \
    mapLayer.js     \
    math.js         \
    shaders.js      \
    shadows.js      \
    skydome.js      \
    sun.js          \
    tile.js         \
    vicinityMap.js

