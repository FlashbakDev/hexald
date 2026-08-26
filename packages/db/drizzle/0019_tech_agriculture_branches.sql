-- Renommage techs : fishing → sailing, woodworking → animal_husbandry
UPDATE world_unlocked_techs SET tech_id = 'sailing' WHERE tech_id = 'fishing';
UPDATE world_unlocked_techs SET tech_id = 'animal_husbandry' WHERE tech_id = 'woodworking';

UPDATE world_tech_progress SET tech_id = 'sailing' WHERE tech_id = 'fishing';
UPDATE world_tech_progress SET tech_id = 'animal_husbandry' WHERE tech_id = 'woodworking';

UPDATE worlds SET research_target_tech_id = 'sailing' WHERE research_target_tech_id = 'fishing';
UPDATE worlds SET research_target_tech_id = 'animal_husbandry' WHERE research_target_tech_id = 'woodworking';
