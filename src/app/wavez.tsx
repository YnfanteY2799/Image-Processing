"use client";
import { type ReactNode, useRef, useEffect } from "react";

export default function ComponentName(): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const vertexShaderSource = `#version 300 es
         in vec4 a_position;
         void main() {
           gl_Position = a_position;
         }
       `;

    const fragmentShaderSource = `#version 300 es
   precision highp float;
   uniform vec2 r;  // Resolution of the canvas
   uniform float t; // Time in seconds
   out vec4 fragColor;
   
   // Convert HSV to RGB color space
   vec3 hsv(float h, float s, float v) {
     vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
     vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
     return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
   }
   
   void main() {
     vec2 FC = gl_FragCoord.xy;
     float i, e, R, s;
     vec3 q, p, d = vec3(FC.xy / r + vec2(-.5, .3), 1.);  // Initial ray direction
     vec3 o = vec3(0);  // Accumulated color
   
     // Ray marching loop
     // This loop implements a basic ray marching algorithm
     // It iteratively steps along the ray and evaluates the scene at each point
     for (q.zy--; i++ < 119.; ) {
       // Color accumulation
       // This step can be seen as a form of alpha blending in volume rendering
       // It creates a layered, depth-based coloring effect
       o.rgb += hsv(-p.y, R * p.y, min(R * e * s - q.z, R) / 9.);
       
       s = 1.;
       // Ray marching step
       // This updates the ray position (q) based on the current direction (d)
       // and the distance estimate (e * R * 0.22)
       p = q += d * e * R * .22;
       
       // Distance field calculation and parameter update
       // This creates a logarithmic spiral pattern in 3D space
       // R = length(p) calculates the distance from the origin to the current point
       p = vec3(log2(R = length(p)) - t, exp(-p.z / R) + R, atan(p.y, p.x) * s);
       
       // Fractal Brownian Motion (fBm) - like noise generation
       // This creates a multi-layered, self-similar noise pattern
       // In signal processing terms, this is similar to multi-octave noise synthesis
       for (e = --p.y; s < 9e2; s += s) {
         // Complex noise function using trigonometric operations
         // This is analogous to a non-linear combination of harmonic oscillators
         e += dot(sin(p.yzx * s), .4 + cos(p.yxy * s + t)) / s * .2;
         
         // Breakdown of the noise function:
         // 1. sin(p.yzx * s) and cos(p.yxy * s + t) create base wave patterns
         //    These act as carrier signals with varying frequencies
         // 2. The dot product combines these waves, creating interference
         //    This is similar to amplitude modulation in signal processing
         // 3. Division by 's' reduces the amplitude at higher frequencies
         //    This creates a 1/f (pink) noise-like spectral characteristic
         // 4. Multiplication by 0.2 controls the overall noise intensity
         // 5. Accumulation in 'e' builds up the fBm-like structure
         //    This accumulation is analogous to summing multiple octaves in noise synthesis
       }
     }
     
     // Output final color
     // Note: No explicit blending is used here; the accumulation in the loop
     // creates an implicit front-to-back blending effect
     fragColor = vec4(o, 1);
   }
   `;

    const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Failed to create shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "r");
    const timeUniformLocation = gl.getUniformLocation(program, "t");

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    let startTime = performance.now();

    const render = () => {
      const currentTime = performance.now();
      const t = (currentTime - startTime) * 0.001;

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(timeUniformLocation, t);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen">
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          display: "block",
        }}
        className="fixed block top-0 left-0 w-[100vw] h-[100vh]"
      />
      <a
        href="https://x.com/YoheiNishitsuji/status/1847182074865754443"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full hover:bg-black/70 transition-colors"
      >
        Original by @YoheiNishitsuji
      </a>
    </div>
  );
}
