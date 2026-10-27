import math
from typing import Dict, List, Optional
from backend.app.schemas.wbs import (
    BuildingParametersInput,
    WbsItem,
    WbsCategory,
    ParametricWbsResponse,
)
from backend.app.schemas.schedule import TaskItem
from backend.app.engine.cpm import CPMEngine

# Standard construction industry ratio & rate distribution template
STANDARD_WBS_TEMPLATE = [
    {
        "category": "1. Substructure & Earthwork",
        "category_percentage": 12.0,
        "items": [
            {
                "code": "WBS-1.1",
                "title": "Site Clearance, Shoring & Bulk Excavation",
                "pct": 3.5,
                "base_days": 18,
                "scale_factor": "area",
                "preds": [],
                "resources": {"excavator": 2, "labor": 12},
            },
            {
                "code": "WBS-1.2",
                "title": "Raft Foundation & Retaining Basement Walls",
                "pct": 8.5,
                "base_days": 24,
                "scale_factor": "basement",
                "preds": ["WBS-1.1"],
                "resources": {"pump": 2, "labor": 20},
            },
        ],
    },
    {
        "category": "2. RCC Superstructure Frame",
        "category_percentage": 38.0,
        "items": [
            {
                "code": "WBS-2.1",
                "title": "Podium / Lower Level RCC Columns & Slab",
                "pct": 10.0,
                "base_days": 22,
                "scale_factor": "fixed",
                "preds": ["WBS-1.2"],
                "resources": {"crane": 1, "labor": 24},
            },
            {
                "code": "WBS-2.2",
                "title": "Mid-Rise Typical Floor Slabs (Floors 1 to N/2)",
                "pct": 14.0,
                "base_days": 35,
                "scale_factor": "floors",
                "preds": ["WBS-2.1"],
                "resources": {"crane": 1, "labor": 25},
            },
            {
                "code": "WBS-2.3",
                "title": "High-Rise Typical Floor Slabs (N/2 to Roof)",
                "pct": 14.0,
                "base_days": 38,
                "scale_factor": "floors",
                "preds": ["WBS-2.2"],
                "resources": {"crane": 1, "labor": 25},
            },
        ],
    },
    {
        "category": "3. Masonry & Wet Finishes",
        "category_percentage": 18.0,
        "items": [
            {
                "code": "WBS-3.1",
                "title": "AAC Block Masonry & Brick Wall Partitions",
                "pct": 8.0,
                "base_days": 30,
                "scale_factor": "area",
                "preds": ["WBS-2.2"],
                "resources": {"labor": 16, "hoist": 1},
            },
            {
                "code": "WBS-3.2",
                "title": "Internal Gypsum Plaster & External Sand-Face",
                "pct": 10.0,
                "base_days": 28,
                "scale_factor": "area",
                "preds": ["WBS-3.1"],
                "resources": {"labor": 20},
            },
        ],
    },
    {
        "category": "4. MEP Building Services",
        "category_percentage": 14.0,
        "items": [
            {
                "code": "WBS-4.1",
                "title": "Internal Electrical Conduits & Plumbing Lines",
                "pct": 6.0,
                "base_days": 25,
                "scale_factor": "floors",
                "preds": ["WBS-3.1"],
                "resources": {"labor": 10},
            },
            {
                "code": "WBS-4.2",
                "title": "Firefighting Wet Risers & Main LT Panels",
                "pct": 8.0,
                "base_days": 22,
                "scale_factor": "fixed",
                "preds": ["WBS-4.1"],
                "resources": {"labor": 12},
            },
        ],
    },
    {
        "category": "5. Architectural Finishing",
        "category_percentage": 12.0,
        "items": [
            {
                "code": "WBS-5.1",
                "title": "Vitrified Tile Flooring & Bathroom Dado",
                "pct": 7.0,
                "base_days": 28,
                "scale_factor": "area",
                "preds": ["WBS-3.2", "WBS-4.1"],
                "resources": {"labor": 14},
            },
            {
                "code": "WBS-5.2",
                "title": "Doors, Aluminum Sliding Windows & Hardware",
                "pct": 5.0,
                "base_days": 20,
                "scale_factor": "area",
                "preds": ["WBS-5.1"],
                "resources": {"labor": 8},
            },
        ],
    },
    {
        "category": "6. External Development & Handover",
        "category_percentage": 6.0,
        "items": [
            {
                "code": "WBS-6.1",
                "title": "Compound Wall, Storm Drain & Paver Blocks",
                "pct": 4.0,
                "base_days": 18,
                "scale_factor": "area",
                "preds": ["WBS-5.2"],
                "resources": {"labor": 12, "excavator": 1},
            },
            {
                "code": "WBS-6.2",
                "title": "Final Testing, Commissioning & Handover",
                "pct": 2.0,
                "base_days": 12,
                "scale_factor": "fixed",
                "preds": ["WBS-4.2", "WBS-6.1"],
                "resources": {"labor": 6},
            },
        ],
    },
]


class WBSGenerator:
    @staticmethod
    def generate(
        params: BuildingParametersInput,
        custom_template: Optional[List[Dict]] = None,
    ) -> ParametricWbsResponse:
        template = custom_template or STANDARD_WBS_TEMPLATE
        total_estimated_cost = round(params.built_up_area_sqft * params.base_rate_per_sqft, 2)

        categories: List[WbsCategory] = []
        all_tasks: List[TaskItem] = []

        area_factor = max(0.6, math.sqrt(params.built_up_area_sqft / 50000.0))
        floor_factor = max(0.7, params.number_of_floors / 12.0)
        basement_factor = max(1.0, params.number_of_basements * 0.9)

        for cat_def in template:
            cat_name = cat_def["category"]
            cat_pct = cat_def["category_percentage"]
            cat_cost = round(total_estimated_cost * (cat_pct / 100.0), 2)
            cat_items: List[WbsItem] = []

            for item_def in cat_def["items"]:
                pct = item_def["pct"]
                cost = round(total_estimated_cost * (pct / 100.0), 2)

                # Duration scaling
                base_days = item_def["base_days"]
                scale = item_def.get("scale_factor", "fixed")
                if scale == "area":
                    duration = max(5, int(base_days * area_factor))
                elif scale == "floors":
                    duration = max(5, int(base_days * floor_factor))
                elif scale == "basement":
                    duration = max(5, int(base_days * basement_factor))
                else:
                    duration = base_days

                wbs_item = WbsItem(
                    wbs_code=item_def["code"],
                    title=item_def["title"],
                    category=cat_name,
                    budget_percentage=pct,
                    estimated_cost=cost,
                    duration_days=duration,
                    predecessors=item_def["preds"],
                    resource_demands=item_def["resources"],
                )
                cat_items.append(wbs_item)

                all_tasks.append(
                    TaskItem(
                        id=wbs_item.wbs_code,
                        name=wbs_item.title,
                        duration=wbs_item.duration_days,
                        predecessors=wbs_item.predecessors,
                        resource_demands=wbs_item.resource_demands,
                        cost_normal=wbs_item.estimated_cost,
                        normal_cost=wbs_item.estimated_cost,
                        cost_crash=round(wbs_item.estimated_cost * 1.35, 2),
                        crash_cost=round(wbs_item.estimated_cost * 1.35, 2),
                        crash_duration=max(1, int(wbs_item.duration_days * 0.65)),
                    )
                )

            categories.append(
                WbsCategory(
                    category_name=cat_name,
                    total_percentage=cat_pct,
                    total_cost=cat_cost,
                    items=cat_items,
                )
            )

        # Verify DAG with CPM engine
        cpm = CPMEngine(all_tasks).compute()

        return ParametricWbsResponse(
            project_name=params.project_name,
            built_up_area_sqft=params.built_up_area_sqft,
            base_rate_per_sqft=params.base_rate_per_sqft,
            total_estimated_cost=total_estimated_cost,
            categories=categories,
            generated_tasks=all_tasks,
            cpm_makespan_days=cpm.project_makespan,
        )
