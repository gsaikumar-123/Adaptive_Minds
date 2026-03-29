from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RoadmapModule(BaseModel):
    moduleName: str
    topics: List[str] = Field(default_factory=list)


class QuestionEvent(BaseModel):
    isCorrect: bool
    difficulty: str = "medium"
    modules: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    createdAt: Optional[datetime] = None


class ForecastRequest(BaseModel):
    learnerId: str
    domain: str
    roadmapModules: List[RoadmapModule]
    questionEvents: List[QuestionEvent] = Field(default_factory=list)
    completedTopics: List[str] = Field(default_factory=list)
    seedKey: str = "adaptive-roadmap"


class TopicForecast(BaseModel):
    topic: str
    moduleName: str
    masteryProbability: float
    masteryScore: int
    confidence: int
    recommendation: str
    priorityScore: int
    evidenceCount: int


class ForecastResponse(BaseModel):
    model: dict
    summary: dict
    recommendations: dict
    policy: dict
    topics: List[TopicForecast]
    generatedAt: str
