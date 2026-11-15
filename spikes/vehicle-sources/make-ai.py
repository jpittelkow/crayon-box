# Makes models/ai-firetruck.glb from models/ai-firetruck-image.png with the TRELLIS.2 text-to-3D Space on Hugging Face.
# The picture came from the same Space (/generate_txt2img) with the prompt in README.md.
# Run:  uv run --with gradio_client python -I spikes/vehicle-sources/make-ai.py spikes/vehicle-sources/models
import shutil, sys, time
from gradio_client import Client, handle_file
out = sys.argv[1]
c = Client("prithivMLmods/TRELLIS.2-Text-to-3D", verbose=False)
try: c.predict(api_name="/start_session")
except Exception as e: print("start_session:", e)
t = time.time()
pre = c.predict(handle_file(f"{out}/ai-firetruck-image.png"), api_name="/preprocess_image")
res = c.predict(handle_file(pre), 0, "1024", 50000, 1024, api_name="/generate_3d")
print("3d", time.time() - t, res, flush=True)
glb = res[1] if isinstance(res, (list, tuple)) else res
shutil.copy(glb, f"{out}/ai-firetruck.glb")
print("done", flush=True)
