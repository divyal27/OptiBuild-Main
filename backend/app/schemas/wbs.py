from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.schedule import TaskItem


class BuildingParametersInput(BaseModel):
    project_name: Optional[str] = Field(default=None, description="Project Name")
    plot_area_sqft: Optional[float] = Field(default=25000.0, description="Plot area in sq.ft.")
    built_up_area_sqft: Optional[float] = Field(default=75000.0, description="Total construction built-up area")
    carpet_area_sqft: Optional[float] = Field(default=52500.0)
    number_of_floors: Optional[int] = Field(default=15, description="Number of above-ground floors (e.g. G+14)")
    number_of_basements: Optional[int] = Field(default=1)
    construction_type: Optional[str] = Field(default="RCC_FRAME", description="RCC_FRAME | PRECAST | COMPOSITE")
    base_rate_per_sqft: Optional[float] = Field(default=2400.0, description="Approximate construction rate (INR/sqft)")
    target_handover_date: Optional[str] = Field(default="2027-12-15")


class WbsItem(BaseModel):
    wbs_code: str
    title: str
    category: str
    budget_percentage: float
    estimated_cost: float
    duration_days: int
    predecessors: List[str]
    resource_demands: Dict[str, int]


class WbsCategory(BaseModel):
    category_name: str
    total_percentage: float
    total_cost: float
    items: List[WbsItem]


class ParametricWbsResponse(BaseModel):
    project_name: Optional[str] = None
    built_up_area_sqft: float
    base_rate_per_sqft: float
    total_estimated_cost: float
    categories: List[WbsCategory]
    generated_tasks: List[TaskItem]
    cpm_makespan_days: int

    @property
    def dag_tasks(self) -> List[TaskItem]:
        return self.generated_tasks
