import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from backend.app.db.session import SessionLocal
from backend.app.db.models import User, Organization, Project
from backend.app.core.auth import hash_password

DEMO_USERS = [
    {
        "email": "admin@optibuild.io",
        "password": "Admin@123",
        "full_name": "System Administrator",
        "role": "admin",
    },
    {
        "email": "pm@optibuild.io",
        "password": "Pm@123",
        "full_name": "Rajesh Sharma (Project Manager)",
        "role": "project_manager",
    },
    {
        "email": "engineer@optibuild.io",
        "password": "Engineer@123",
        "full_name": "Amit Patil (Site Engineer)",
        "role": "site_engineer",
    },
    {
        "email": "site@optibuild.io",
        "password": "Site@123",
        "full_name": "Amit Patil (Site Engineer)",
        "role": "site_engineer",
    },
    {
        "email": "store@optibuild.io",
        "password": "Store@123",
        "full_name": "Suresh Deshmukh (Store Keeper)",
        "role": "store_keeper",
    },
    {
        "email": "architect@optibuild.io",
        "password": "Architect@123",
        "full_name": "Pooja Kulkarni (Lead Architect)",
        "role": "architect",
    },
    {
        "email": "accountant@optibuild.io",
        "password": "Accountant@123",
        "full_name": "Vikas Joshi (Project Accountant)",
        "role": "accountant",
    },
    {
        "email": "owner@optibuild.io",
        "password": "Owner@123",
        "full_name": "Anand Singhania (Owner / Developer)",
        "role": "owner",
    },
]

DEMO_ORGANIZATION_NAME = "OptiBuild Infrastructure Corp"


def seed_database():
    """
    Seeds ONLY the 7 demo role users and 1 empty organization.
    Ensures zero fake projects or mock MahaRERA certificates.
    """
    print("[*] Running OptiBuild seed script...")
    from backend.app.db.session import engine, Base
    import backend.app.db.models
    if engine:
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed or find empty organization
        org = db.query(Organization).filter(Organization.name == DEMO_ORGANIZATION_NAME).first()
        if not org:
            org = Organization(name=DEMO_ORGANIZATION_NAME)
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"[+] Created organization: {org.name} ({org.id})")
        else:
            print(f"[*] Organization exists: {org.name} ({org.id})")

        # 2. Seed 7 demo role users
        created_count = 0
        updated_count = 0
        for user_data in DEMO_USERS:
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing:
                user = User(
                    email=user_data["email"],
                    hashed_password=hash_password(user_data["password"]),
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=True,
                )
                db.add(user)
                created_count += 1
                print(f"[+] Created user: {user_data['email']} [role: {user_data['role']}]")
            else:
                existing.hashed_password = hash_password(user_data["password"])
                existing.full_name = user_data["full_name"]
                existing.role = user_data["role"]
                existing.is_active = True
                updated_count += 1
                print(f"[*] Updated password & role for user: {user_data['email']} [role: {user_data['role']}]")

        db.commit()
        print(f"\n[SUCCESS] Seed complete. {created_count} users created, {updated_count} users refreshed.")
        print(f"[*] Demo users ready for all 7 roles with passwords from README.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
