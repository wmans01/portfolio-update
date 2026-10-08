"""Export selected shape-v2 checkpoint. Requires CPU torch + numpy.
Usage: python scripts/export-handwriting.py /path/to/extracted/archive
"""
import hashlib, json, sys
from pathlib import Path
import torch

source = Path(sys.argv[1])
ck = torch.load(source / 'selected-model.pt', map_location='cpu', weights_only=True)
assert ck['format'] == 'ink-study-shape-v2'
state = ck['model']
out = Path('public/handwriting-model'); out.mkdir(parents=True, exist_ok=True)
keys = ['means', 'scales', 'masks', 'embedding.weight'] + [f'decoder.{i}.{k}' for i in (0, 2, 4) for k in ('weight', 'bias')]
manifest = {'format': ck['format'], 'epoch': ck['epoch'] + 1, 'checkpointSha256': hashlib.sha256((source / 'selected-model.pt').read_bytes()).hexdigest(), 'config': {k: ck['config'][k] for k in ('points', 'latent', 'hidden', 'embedding')}, 'groups': [{k: g[k] for k in ('label', 'count', 'strokes')} for g in ck['metadata']['groups']], 'bank': ck['bank'], 'tensors': {}}
data = bytearray()
for key in keys:
    t = state[key].contiguous().numpy().astype('<f4')
    manifest['tensors'][key] = {'offset': len(data) // 4, 'shape': list(t.shape), 'length': t.size}
    data.extend(t.tobytes())
(out / 'weights.bin').write_bytes(data)
(out / 'model.json').write_text(json.dumps(manifest, separators=(',', ':')))
# Independent PyTorch decoder reference for every group, including all active masks.
cases = []
for gid in range(len(manifest['groups'])):
    z = torch.tensor(ck['bank'][str(gid)][0])
    x = torch.cat((z, state['embedding.weight'][gid]))
    for i in (0, 2, 4):
        x = torch.nn.functional.linear(x, state[f'decoder.{i}.weight'], state[f'decoder.{i}.bias'])
        if i != 4: x = torch.nn.functional.silu(x)
    residual = 3 * torch.tanh(x.reshape(state['means'].shape[1:]) / 3) * state['masks'][gid]
    xy = state['means'][gid] + state['scales'][gid] * .7 * residual
    cases.append({'group': gid, 'z': z.tolist(), 'expected': xy.flatten().tolist()})
Path('scripts/handwriting-parity.json').write_text(json.dumps(cases, separators=(',', ':')))
print(f'Exported epoch {manifest["epoch"]}, {len(manifest["groups"])} groups, {len(data)} tensor bytes')
