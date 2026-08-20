"""PyTorch MLP that scores (purchase, card) pairs for the credit advisor.

Input vector (7 features, already in product units; the network z-scores them):
  [purchase_amount, category_id, card_apr, days_until_due,
   days_since_statement_close, utilization_ratio, cashback_rate]

Output: a continuous utility score. Higher = better card for this purchase.

Train + export in one step:
  python ml/ranker.py train --export

Export an existing checkpoint:
  python ml/ranker.py export --checkpoint ml/artifacts/card_ranker.pt --onnx ml/artifacts/card_ranker.onnx
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from features import ARTIFACT_DIR, CATEGORIES, FEATURE_DIM, FEATURE_NAMES
from heuristic import teacher_utility


class CardRanker(nn.Module):
    """3-layer MLP with in-graph z-score normalization so ONNX inference is self-contained."""

    def __init__(self, hidden: tuple[int, int] = (64, 32)) -> None:
        super().__init__()
        self.register_buffer("feat_mean", torch.zeros(FEATURE_DIM))
        self.register_buffer("feat_std", torch.ones(FEATURE_DIM))
        h1, h2 = hidden
        self.net = nn.Sequential(
            nn.Linear(FEATURE_DIM, h1),
            nn.ReLU(),
            nn.Linear(h1, h2),
            nn.ReLU(),
            nn.Linear(h2, 1),
        )

    def set_normalizer(self, mean: np.ndarray, std: np.ndarray) -> None:
        self.feat_mean.copy_(torch.tensor(mean, dtype=torch.float32))
        safe_std = np.where(std < 1e-6, 1.0, std)
        self.feat_std.copy_(torch.tensor(safe_std, dtype=torch.float32))

    def normalize(self, features: torch.Tensor) -> torch.Tensor:
        return (features - self.feat_mean) / self.feat_std

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        # features: [batch, 7] -> utility: [batch]
        return self.net(self.normalize(features)).squeeze(-1)


def synthesize_dataset(n_samples: int, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    amount = rng.uniform(8.0, 1800.0, size=n_samples)
    category_id = rng.integers(0, len(CATEGORIES), size=n_samples).astype(np.float64)
    apr = rng.uniform(14.99, 28.99, size=n_samples)
    days_until_due = rng.uniform(0.0, 45.0, size=n_samples)
    days_since_close = rng.uniform(0.0, 31.0, size=n_samples)
    utilization = rng.beta(2.0, 3.5, size=n_samples)
    # Sprinkle over-limit examples so the model learns to bury them.
    over_limit = rng.random(n_samples) < 0.08
    utilization = np.where(over_limit, rng.uniform(1.0, 1.25, size=n_samples), utilization)
    cashback = rng.choice([0.01, 0.015, 0.02, 0.03, 0.05, 0.06], size=n_samples)

    features = np.stack(
        [amount, category_id, apr, days_until_due, days_since_close, utilization, cashback],
        axis=1,
    ).astype(np.float32)
    labels = np.array([teacher_utility(row) for row in features], dtype=np.float32)
    labels += rng.normal(0.0, 0.02, size=n_samples).astype(np.float32)
    return features, labels.astype(np.float32)


def train_model(
    epochs: int,
    samples: int,
    batch_size: int,
    lr: float,
    seed: int,
) -> CardRanker:
    torch.manual_seed(seed)
    features, labels = synthesize_dataset(samples, seed=seed)
    mean = features.mean(axis=0)
    std = features.std(axis=0)

    model = CardRanker()
    model.set_normalizer(mean, std)
    model.train()

    dataset = TensorDataset(torch.from_numpy(features), torch.from_numpy(labels))
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    for epoch in range(1, epochs + 1):
        running = 0.0
        for batch_x, batch_y in loader:
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = loss_fn(preds, batch_y)
            loss.backward()
            optimizer.step()
            running += float(loss.item()) * len(batch_x)
        if epoch == 1 or epoch % 5 == 0 or epoch == epochs:
            print(f"epoch {epoch:03d}/{epochs}  mse={running / samples:.5f}")

    model.eval()
    return model


def save_checkpoint(model: CardRanker, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "feature_names": FEATURE_NAMES,
            "feat_mean": model.feat_mean.cpu().tolist(),
            "feat_std": model.feat_std.cpu().tolist(),
        },
        path,
    )
    print(f"wrote checkpoint {path}")


def load_ranker(checkpoint: Path) -> CardRanker:
    payload = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model = CardRanker()
    model.load_state_dict(payload["state_dict"])
    model.eval()
    return model


def export_onnx(model: CardRanker, onnx_path: Path) -> None:
    """Export command used by the Next.js ranker (onnxruntime-node or ml/infer.py)."""
    onnx_path.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    dummy = torch.zeros(1, FEATURE_DIM, dtype=torch.float32)
    export_kwargs = dict(
        input_names=["features"],
        output_names=["utility"],
        dynamic_axes={"features": {0: "batch_size"}, "utility": {0: "batch_size"}},
        opset_version=17,
    )
    try:
        torch.onnx.export(model, dummy, str(onnx_path), dynamo=False, **export_kwargs)
    except TypeError:
        torch.onnx.export(model, dummy, str(onnx_path), **export_kwargs)
    print(f"wrote ONNX model {onnx_path}")


def score_feature_matrix(model: CardRanker, features: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        tensor = torch.from_numpy(np.asarray(features, dtype=np.float32))
        if tensor.ndim == 1:
            tensor = tensor.unsqueeze(0)
        return model(tensor).cpu().numpy()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train or export the card ranker MLP.")
    sub = parser.add_subparsers(dest="command", required=True)

    train = sub.add_parser("train", help="Fit the MLP on synthetic ranking labels.")
    train.add_argument("--epochs", type=int, default=30)
    train.add_argument("--samples", type=int, default=8000)
    train.add_argument("--batch-size", type=int, default=64)
    train.add_argument("--lr", type=float, default=1e-3)
    train.add_argument("--seed", type=int, default=42)
    train.add_argument("--out", type=Path, default=ARTIFACT_DIR)
    train.add_argument(
        "--export",
        action="store_true",
        help="Also write card_ranker.onnx next to the checkpoint.",
    )

    export = sub.add_parser("export", help="Convert a .pt checkpoint to ONNX.")
    export.add_argument("--checkpoint", type=Path, default=ARTIFACT_DIR / "card_ranker.pt")
    export.add_argument("--onnx", type=Path, default=ARTIFACT_DIR / "card_ranker.onnx")

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.command == "train":
        model = train_model(
            epochs=args.epochs,
            samples=args.samples,
            batch_size=args.batch_size,
            lr=args.lr,
            seed=args.seed,
        )
        checkpoint = args.out / "card_ranker.pt"
        save_checkpoint(model, checkpoint)
        if args.export:
            export_onnx(model, args.out / "card_ranker.onnx")
        return 0

    if args.command == "export":
        if not args.checkpoint.exists():
            print(f"checkpoint not found: {args.checkpoint}", file=sys.stderr)
            print("Train first: python ml/ranker.py train --export", file=sys.stderr)
            return 1
        model = load_ranker(args.checkpoint)
        export_onnx(model, args.onnx)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
