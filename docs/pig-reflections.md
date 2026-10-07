# Blender reflections

The source project is `slypork_pig4.blend`.
It uses the `forest.exr` studio environment in Material Preview, with scene
lighting and scene world disabled. Its lens material is a dark dielectric:
base color `(0.012, 0.012, 0.012)`, metallic 0, roughness 0.05, and IOR 1.5.
The website retains the exported material and normals without custom lens
shaders, metalness changes, or reflection images applied as color.

`assets/models/forest.exr` is copied directly from Blender 5.1's bundled studio
environments. It is the same image available as **Forest** in the Material
Preview environment picker. Blender credits Greg Zaal (Poly Haven) and licenses
the HDRI as CC0. Its original source is
[Ninomaru Teien](https://polyhaven.com/a/ninomaru_teien). The bundled license is
saved alongside the environment as `BLENDER-HDRI-LICENSE.txt`.

The browser loads this linear HDR map as the scene's reflection and ambient
lighting environment, prefiltered by Three.js. Its rotation is `(0.35, 1.2, 0)`
in Three.js radians to place branches and sky gaps in the reflected view of
both lenses at rest. Direct lighting, camera,
and tone mapping can still produce differences from Blender's Material Preview.
The nearly flat lens faces each reflect a small part of the environment.

Blender's studio environment and World lighting are not included in GLB exports,
so changing only the HDRI does not require re-exporting the model. To preview
the same source map in Blender, use the **Forest** Material Preview environment.
World lighting for rendered mode can instead use the same `forest.exr` through
an Environment Texture node.
