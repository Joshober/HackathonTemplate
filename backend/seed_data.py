"""
Seed script to populate MongoDB with example OKR data showcasing all features.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    # Try loading from parent directory
    load_dotenv(Path(__file__).parent.parent / '.env')

from app.db.mongodb import get_db
from datetime import datetime, timedelta
from bson import ObjectId

def seed_database():
    db = get_db()
    
    # Clear existing data (optional - comment out if you want to keep existing data)
    print("Clearing existing data...")
    db.objectives.delete_many({})
    db.key_results.delete_many({})
    db.user_roles.delete_many({})
    db.audit_logs.delete_many({})
    db.file_artifacts.delete_many({})
    
    print("Creating user roles...")
    # Create user roles
    users = [
        {'userId': 'user-admin-1', 'role': 'admin', 'department': 'Engineering'},
        {'userId': 'user-leader-1', 'role': 'leader', 'department': 'Engineering'},
        {'userId': 'user-leader-2', 'role': 'leader', 'department': 'Product'},
        {'userId': 'user-standard-1', 'role': 'standard', 'department': 'Engineering'},
        {'userId': 'user-standard-2', 'role': 'standard', 'department': 'Product'},
        {'userId': 'user-viewonly-1', 'role': 'view_only', 'department': 'Sales'},
    ]
    
    for user in users:
        db.user_roles.update_one(
            {'userId': user['userId']},
            {
                '$set': {
                    **user,
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow(),
                }
            },
            upsert=True
        )
    
    print("Creating objectives...")
    now = datetime.utcnow()
    
    # Strategic Objective 1 - Active with dependencies
    strategic_obj_1 = {
        '_id': ObjectId(),
        'title': 'Increase Customer Satisfaction Score to 4.5+',
        'description': 'Improve overall customer satisfaction across all touchpoints to achieve industry-leading NPS scores.',
        'ownerId': 'user-leader-1',
        'level': 'strategic',
        'timeline': 'annual',
        'fiscalYear': 2024,
        'division': 'Engineering',
        'workflowState': 'active',
        'workflowHistory': [
            {
                'state': 'draft',
                'userId': 'user-leader-1',
                'timestamp': now - timedelta(days=30),
                'reason': 'Initial creation',
                'comment': 'Created strategic objective'
            },
            {
                'state': 'submitted',
                'userId': 'user-leader-1',
                'timestamp': now - timedelta(days=25),
                'reason': 'Ready for review',
                'comment': 'Submitted for approval'
            },
            {
                'state': 'approved',
                'userId': 'user-admin-1',
                'timestamp': now - timedelta(days=20),
                'reason': 'Approved by leadership',
                'comment': 'Looks good, approved'
            },
            {
                'state': 'active',
                'userId': 'user-leader-1',
                'timestamp': now - timedelta(days=15),
                'reason': 'Activated',
                'comment': 'Objective is now active'
            }
        ],
        'permissions': {
            'viewOnly': ['user-viewonly-1'],
            'editKeyResults': ['user-standard-1', 'user-standard-2'],
            'editObjective': ['user-leader-1'],
            'fullControl': ['user-admin-1']
        },
        'riskFlag': False,
        'milestones': [
            {'title': 'Q1 Baseline Measurement', 'date': now + timedelta(days=30), 'status': 'pending'},
            {'title': 'Q2 Improvement Initiatives', 'date': now + timedelta(days=90), 'status': 'pending'},
            {'title': 'Q3 Mid-Year Review', 'date': now + timedelta(days=180), 'status': 'pending'},
        ],
        'dependencies': [],
        'files': [],
        'pinnedFields': {
            'theme': 'Customer Experience',
            'roadmap': 'Q1: Baseline, Q2: Initiatives, Q3: Review',
            'customerSegments': 'Enterprise, SMB, Consumer',
            'value': 'High - Directly impacts retention and revenue',
            'documents': 'Customer_Satisfaction_Plan.pdf',
            'overallNecessity': 'Critical',
            'deliveryProgress': 0.3
        },
        'createdAt': now - timedelta(days=30),
        'updatedAt': now - timedelta(days=1),
        'lastModified': now - timedelta(days=1),
    }
    
    # Strategic Objective 2 - Under Review
    strategic_obj_2 = {
        '_id': ObjectId(),
        'title': 'Launch New Product Line by Q3',
        'description': 'Develop and launch three new product offerings to expand market reach.',
        'ownerId': 'user-leader-2',
        'level': 'strategic',
        'timeline': 'annual',
        'fiscalYear': 2024,
        'division': 'Product',
        'workflowState': 'under_review',
        'workflowHistory': [
            {
                'state': 'draft',
                'userId': 'user-leader-2',
                'timestamp': now - timedelta(days=10),
                'reason': 'Initial creation',
                'comment': 'Draft created'
            },
            {
                'state': 'submitted',
                'userId': 'user-leader-2',
                'timestamp': now - timedelta(days=5),
                'reason': 'Ready for review',
                'comment': 'Submitted for approval'
            },
            {
                'state': 'under_review',
                'userId': 'user-admin-1',
                'timestamp': now - timedelta(days=2),
                'reason': 'Under review',
                'comment': 'Reviewing with stakeholders'
            }
        ],
        'permissions': {
            'viewOnly': [],
            'editKeyResults': ['user-standard-2'],
            'editObjective': ['user-leader-2'],
            'fullControl': ['user-admin-1']
        },
        'riskFlag': False,
        'milestones': [],
        'dependencies': [],
        'files': [],
        'pinnedFields': {
            'theme': 'Product Innovation',
            'roadmap': 'Q1: Research, Q2: Development, Q3: Launch',
            'customerSegments': 'Enterprise, SMB',
            'value': 'High - New revenue stream',
            'overallNecessity': 'Important',
            'deliveryProgress': 0.1
        },
        'createdAt': now - timedelta(days=10),
        'updatedAt': now - timedelta(days=2),
        'lastModified': now - timedelta(days=2),
    }
    
    # Functional Objective - Approved
    functional_obj_1 = {
        '_id': ObjectId(),
        'title': 'Improve API Response Times by 40%',
        'description': 'Optimize backend services to reduce average API response time from 500ms to 300ms.',
        'ownerId': 'user-leader-1',
        'level': 'functional',
        'timeline': 'quarterly',
        'fiscalYear': 2024,
        'quarter': 'Q1',
        'parentObjectiveId': strategic_obj_1['_id'],
        'division': 'Engineering',
        'workflowState': 'approved',
        'workflowHistory': [
            {
                'state': 'draft',
                'userId': 'user-leader-1',
                'timestamp': now - timedelta(days=20),
                'reason': 'Initial creation',
                'comment': 'Created functional objective'
            },
            {
                'state': 'submitted',
                'userId': 'user-leader-1',
                'timestamp': now - timedelta(days=15),
                'reason': 'Ready for review',
                'comment': 'Submitted'
            },
            {
                'state': 'approved',
                'userId': 'user-admin-1',
                'timestamp': now - timedelta(days=10),
                'reason': 'Approved',
                'comment': 'Good technical objective'
            }
        ],
        'permissions': {
            'viewOnly': [],
            'editKeyResults': ['user-standard-1'],
            'editObjective': ['user-leader-1'],
            'fullControl': ['user-admin-1']
        },
        'riskFlag': False,
        'milestones': [],
        'dependencies': [
            {
                'objectiveId': strategic_obj_1['_id'],
                'type': 'depends_on',
                'impact': 'high',
                'progress': 0.3,
                'isAtRisk': False,
                'linkedAt': now - timedelta(days=18),
                'linkedBy': 'user-leader-1'
            }
        ],
        'files': [],
        'pinnedFields': {
            'theme': 'Performance',
            'roadmap': 'Q1: Optimization sprint',
            'value': 'Medium - Improves user experience',
            'deliveryProgress': 0.2
        },
        'createdAt': now - timedelta(days=20),
        'updatedAt': now - timedelta(days=10),
        'lastModified': now - timedelta(days=10),
    }
    
    # Tactical Objective - Draft with at-risk dependency
    tactical_obj_1 = {
        '_id': ObjectId(),
        'title': 'Implement Caching Layer for User Data',
        'description': 'Add Redis caching to reduce database load and improve response times.',
        'ownerId': 'user-standard-1',
        'level': 'tactical',
        'timeline': 'quarterly',
        'fiscalYear': 2024,
        'quarter': 'Q1',
        'parentObjectiveId': functional_obj_1['_id'],
        'division': 'Engineering',
        'workflowState': 'draft',
        'workflowHistory': [
            {
                'state': 'draft',
                'userId': 'user-standard-1',
                'timestamp': now - timedelta(days=5),
                'reason': 'Initial creation',
                'comment': 'Draft created'
            }
        ],
        'permissions': {
            'viewOnly': [],
            'editKeyResults': ['user-standard-1'],
            'editObjective': ['user-leader-1'],
            'fullControl': []
        },
        'riskFlag': True,
        'milestones': [],
        'dependencies': [
            {
                'objectiveId': functional_obj_1['_id'],
                'type': 'depends_on',
                'impact': 'high',
                'progress': 0.2,
                'isAtRisk': True,
                'linkedAt': now - timedelta(days=3),
                'linkedBy': 'user-standard-1'
            }
        ],
        'files': [],
        'pinnedFields': {
            'theme': 'Technical Infrastructure',
            'deliveryProgress': 0.1
        },
        'createdAt': now - timedelta(days=5),
        'updatedAt': now - timedelta(days=5),
        'lastModified': now - timedelta(days=5),
    }
    
    # Insert objectives
    objectives = [strategic_obj_1, strategic_obj_2, functional_obj_1, tactical_obj_1]
    db.objectives.insert_many(objectives)
    
    print("Creating key results...")
    
    # Key Results for Strategic Objective 1
    kr1_1 = {
        '_id': ObjectId(),
        'objectiveId': strategic_obj_1['_id'],
        'title': 'Achieve NPS score of 50+',
        'target': '50',
        'currentValue': '42',
        'unit': 'NPS',
        'score': 0.84,  # 42/50 = 0.84
        'ownerId': 'user-standard-1',
        'partnerId': 'user-standard-2',
        'expectedEoQScore': 1.0,
        'notes': [
            {
                'text': 'Q1 baseline measurement completed. Current NPS at 42, on track for target.',
                'date': '2024-01-15',
                'userId': 'user-standard-1',
                'createdAt': now - timedelta(days=10)
            },
            {
                'text': 'Customer feedback program launched. Expecting improvements in Q2.',
                'date': '2024-01-20',
                'userId': 'user-standard-1',
                'createdAt': now - timedelta(days=5)
            }
        ],
        'scoreHistory': [
            {'score': 0.7, 'timestamp': now - timedelta(days=30), 'userId': 'user-standard-1', 'note': 'Initial measurement'},
            {'score': 0.75, 'timestamp': now - timedelta(days=20), 'userId': 'user-standard-1', 'note': 'Q1 progress'},
            {'score': 0.84, 'timestamp': now - timedelta(days=5), 'userId': 'user-standard-1', 'note': 'Latest update'}
        ],
        'targetDate': now + timedelta(days=270),
        'velocity': 0.005,  # Approximate daily improvement
        'createdAt': now - timedelta(days=30),
        'lastUpdatedAt': now - timedelta(days=5),
        'lastModified': now - timedelta(days=5),
    }
    
    kr1_2 = {
        '_id': ObjectId(),
        'objectiveId': strategic_obj_1['_id'],
        'title': 'Reduce customer support ticket volume by 25%',
        'target': '25',
        'currentValue': '18',
        'unit': '% reduction',
        'score': 0.72,  # 18/25 = 0.72
        'ownerId': 'user-standard-2',
        'partnerId': None,
        'expectedEoQScore': 0.9,
        'notes': [
            {
                'text': 'Self-service portal improvements showing positive results.',
                'date': '2024-01-18',
                'userId': 'user-standard-2',
                'createdAt': now - timedelta(days=7)
            }
        ],
        'scoreHistory': [
            {'score': 0.6, 'timestamp': now - timedelta(days=25), 'userId': 'user-standard-2', 'note': 'Baseline'},
            {'score': 0.72, 'timestamp': now - timedelta(days=7), 'userId': 'user-standard-2', 'note': 'Current'}
        ],
        'targetDate': now + timedelta(days=240),
        'velocity': 0.004,
        'createdAt': now - timedelta(days=25),
        'lastUpdatedAt': now - timedelta(days=7),
        'lastModified': now - timedelta(days=7),
    }
    
    # Key Results for Strategic Objective 2
    kr2_1 = {
        '_id': ObjectId(),
        'objectiveId': strategic_obj_2['_id'],
        'title': 'Complete market research for 3 product concepts',
        'target': '3',
        'currentValue': '2',
        'unit': 'concepts',
        'score': 0.67,
        'ownerId': 'user-standard-2',
        'partnerId': None,
        'expectedEoQScore': 1.0,
        'notes': [
            {
                'text': 'Two concepts validated. Third concept research in progress.',
                'date': '2024-01-22',
                'userId': 'user-standard-2',
                'createdAt': now - timedelta(days=3)
            }
        ],
        'scoreHistory': [
            {'score': 0.33, 'timestamp': now - timedelta(days=8), 'userId': 'user-standard-2', 'note': 'First concept'},
            {'score': 0.67, 'timestamp': now - timedelta(days=3), 'userId': 'user-standard-2', 'note': 'Second concept'}
        ],
        'targetDate': now + timedelta(days=30),
        'velocity': 0.033,
        'createdAt': now - timedelta(days=10),
        'lastUpdatedAt': now - timedelta(days=3),
        'lastModified': now - timedelta(days=3),
    }
    
    # Key Results for Functional Objective 1
    kr3_1 = {
        '_id': ObjectId(),
        'objectiveId': functional_obj_1['_id'],
        'title': 'Reduce average API response time to 300ms',
        'target': '300',
        'currentValue': '420',
        'unit': 'ms',
        'score': 0.71,  # (500-420)/(500-300) = 0.71
        'ownerId': 'user-standard-1',
        'partnerId': None,
        'expectedEoQScore': 1.0,
        'notes': [
            {
                'text': 'Database query optimization completed. Response times improving.',
                'date': '2024-01-25',
                'userId': 'user-standard-1',
                'createdAt': now - timedelta(days=1)
            }
        ],
        'scoreHistory': [
            {'score': 0.5, 'timestamp': now - timedelta(days=15), 'userId': 'user-standard-1', 'note': 'Baseline: 500ms'},
            {'score': 0.65, 'timestamp': now - timedelta(days=8), 'userId': 'user-standard-1', 'note': 'After optimization: 430ms'},
            {'score': 0.71, 'timestamp': now - timedelta(days=1), 'userId': 'user-standard-1', 'note': 'Current: 420ms'}
        ],
        'targetDate': now + timedelta(days=60),
        'velocity': 0.014,
        'createdAt': now - timedelta(days=20),
        'lastUpdatedAt': now - timedelta(days=1),
        'lastModified': now - timedelta(days=1),
    }
    
    # Key Results for Tactical Objective 1
    kr4_1 = {
        '_id': ObjectId(),
        'objectiveId': tactical_obj_1['_id'],
        'title': 'Deploy Redis caching for user profile data',
        'target': '100',
        'currentValue': '0',
        'unit': '% coverage',
        'score': 0.0,
        'ownerId': 'user-standard-1',
        'partnerId': None,
        'expectedEoQScore': 0.8,
        'notes': [
            {
                'text': 'Redis infrastructure setup in progress. Waiting on dependency approval.',
                'date': '2024-01-26',
                'userId': 'user-standard-1',
                'createdAt': now
            }
        ],
        'scoreHistory': [],
        'targetDate': now + timedelta(days=45),
        'velocity': 0.0,
        'createdAt': now - timedelta(days=5),
        'lastUpdatedAt': now,
        'lastModified': now,
    }
    
    # Insert key results
    key_results = [kr1_1, kr1_2, kr2_1, kr3_1, kr4_1]
    db.key_results.insert_many(key_results)
    
    # Update strategic_obj_1 dependencies to include functional_obj_1
    strategic_obj_1_deps = [
        {
            'objectiveId': functional_obj_1['_id'],
            'type': 'downstream',
            'impact': 'high',
            'progress': 0.2,
            'isAtRisk': False,
            'linkedAt': now - timedelta(days=18),
            'linkedBy': 'user-leader-1'
        }
    ]
    db.objectives.update_one(
        {'_id': strategic_obj_1['_id']},
        {'$set': {'dependencies': strategic_obj_1_deps}}
    )
    
    print("Creating audit logs...")
    # Create some audit log entries
    audit_logs = [
        {
            'entityType': 'objective',
            'entityId': strategic_obj_1['_id'],
            'action': 'created',
            'userId': 'user-leader-1',
            'timestamp': now - timedelta(days=30),
            'changes': [],
            'reason': 'Objective created'
        },
        {
            'entityType': 'objective',
            'entityId': strategic_obj_1['_id'],
            'action': 'workflow_transition',
            'userId': 'user-admin-1',
            'timestamp': now - timedelta(days=20),
            'changes': [
                {'field': 'workflowState', 'oldValue': 'submitted', 'newValue': 'approved'}
            ],
            'reason': 'Approved by leadership'
        },
        {
            'entityType': 'key_result',
            'entityId': kr1_1['_id'],
            'action': 'updated',
            'userId': 'user-standard-1',
            'timestamp': now - timedelta(days=5),
            'changes': [
                {'field': 'score', 'oldValue': 0.75, 'newValue': 0.84},
                {'field': 'currentValue', 'oldValue': '38', 'newValue': '42'}
            ],
            'reason': 'Updated progress based on latest survey results'
        },
        {
            'entityType': 'objective',
            'entityId': functional_obj_1['_id'],
            'action': 'dependency_added',
            'userId': 'user-leader-1',
            'timestamp': now - timedelta(days=18),
            'changes': [
                {'field': 'dependencies', 'oldValue': 0, 'newValue': 1}
            ],
            'reason': 'Added dependency link to strategic objective'
        }
    ]
    
    db.audit_logs.insert_many(audit_logs)
    
    print("Database seeded successfully!")
    print(f"\nCreated:")
    print(f"  - {len(objectives)} objectives")
    print(f"  - {len(key_results)} key results")
    print(f"  - {len(users)} user roles")
    print(f"  - {len(audit_logs)} audit log entries")
    print(f"\nExample objectives:")
    print(f"  1. {strategic_obj_1['title']} (Active)")
    print(f"  2. {strategic_obj_2['title']} (Under Review)")
    print(f"  3. {functional_obj_1['title']} (Approved)")
    print(f"  4. {tactical_obj_1['title']} (Draft, At Risk)")

if __name__ == '__main__':
    seed_database()
