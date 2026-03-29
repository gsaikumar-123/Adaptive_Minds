from __future__ import annotations

from dataclasses import asdict, dataclass

import torch
import torch.nn as nn


@dataclass
class DKTConfig:
    num_topics: int
    num_modules: int
    hidden_size: int = 96
    num_layers: int = 1
    dropout: float = 0.1
    topic_embedding_dim: int = 32
    module_embedding_dim: int = 16
    difficulty_embedding_dim: int = 8
    correctness_embedding_dim: int = 6
    gap_bucket_embedding_dim: int = 8


class DKTGRU(nn.Module):
    def __init__(self, config: DKTConfig):
        super().__init__()
        self.config = config

        self.topic_embedding = nn.Embedding(config.num_topics + 1, config.topic_embedding_dim, padding_idx=0)
        self.module_embedding = nn.Embedding(config.num_modules + 1, config.module_embedding_dim, padding_idx=0)
        self.difficulty_embedding = nn.Embedding(4, config.difficulty_embedding_dim, padding_idx=0)
        self.correctness_embedding = nn.Embedding(3, config.correctness_embedding_dim, padding_idx=0)
        self.gap_bucket_embedding = nn.Embedding(8, config.gap_bucket_embedding_dim, padding_idx=0)

        input_dim = (
            config.topic_embedding_dim
            + config.module_embedding_dim
            + config.difficulty_embedding_dim
            + config.correctness_embedding_dim
            + config.gap_bucket_embedding_dim
            + 1
        )

        self.gru = nn.GRU(
            input_size=input_dim,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.dropout = nn.Dropout(config.dropout)
        self.output_head = nn.Linear(config.hidden_size, config.num_topics)

    def forward(
        self,
        topic_ids: torch.Tensor,
        module_ids: torch.Tensor,
        difficulty_ids: torch.Tensor,
        correctness_ids: torch.Tensor,
        gap_bucket_ids: torch.Tensor,
        recency_days: torch.Tensor,
    ) -> torch.Tensor:
        topic_vec = self.topic_embedding(topic_ids)
        module_vec = self.module_embedding(module_ids)
        diff_vec = self.difficulty_embedding(difficulty_ids)
        corr_vec = self.correctness_embedding(correctness_ids)
        gap_vec = self.gap_bucket_embedding(gap_bucket_ids)

        recency_vec = recency_days.unsqueeze(-1)

        x = torch.cat([topic_vec, module_vec, diff_vec, corr_vec, gap_vec, recency_vec], dim=-1)
        output, _ = self.gru(x)
        output = self.dropout(output)
        logits = self.output_head(output)
        return logits

    def to_metadata(self) -> dict:
        return asdict(self.config)
