"""Dev tool: seed clearly-labelled sample profiles so the app can be explored immediately.

Usage:
  python seed.py                      # upsert sample profiles (idempotent)
  python seed.py --likes-for +1555..  # additionally make 6 sample profiles like that phone's account
  python seed.py --clear              # remove all sample profiles and their swipes/matches
"""
import asyncio
import sys
import uuid
from datetime import date, timedelta

from core import db, now_iso, is_profile_complete, ANYWHERE_KM

U = "https://images.unsplash.com/photo-{}?w=900&q=80&auto=format&fit=crop"

W = ["1494790108377-be9c29b29330", "1438761681033-6461ffad8d80", "1534528741775-53994a69daeb", "1524504388940-b1c1722653e1",
     "1517841905240-472988babdf9", "1488426862026-3ee34a7d66df", "1544005313-94ddf0286df2", "1502823403499-6ccfcf4fb453",
     "1508214751196-bcfd4ca60f91", "1520466809213-7b9a56adcd45", "1529626455594-4ff0802cfb7e", "1548142813-c348350df52b",
     "1541534401786-2077eed87a74", "1509967419530-da38b4704bc6", "1531123897727-8f129e1688ce", "1487412720507-e7ab37603c6f",
     "1567532939604-b6b5b0db2604", "1524250502761-1ac6f2e30d43", "1499996860823-5214fcc65f8f", "1554151228-14d9def656e4",
     "1519345182560-3f2917c472ef", "1506863530036-1efeddceb993", "1489424731084-a5d8b219a5bb", "1500917293891-ef795e70e1f6",
     "1496345875659-11f7dd282d1d", "1521146764736-56c929d59c83", "1520813792240-56fc4a3765a7", "1519699047748-de8e457a634e",
     "1525134479668-1bee5c7c6845", "1502164980785-f8aa41d53611"]
M = ["1507003211169-0a1dd7228f2d", "1500648767791-00dcc994a43e", "1506794778202-cad84cf45f1d", "1539571696357-5a69c17a67c6",
     "1531427186611-ecfd6d936c79", "1492562080023-ab3db95bfbce", "1519085360753-af0119f7cbe7", "1521119989659-a83eee488004",
     "1463453091185-61582044d556", "1504257432389-52343af06ae3", "1552058544-f2b08422138a", "1566492031773-4f4e44671857",
     "1480429370139-e0132c086e2a", "1543610892-0b1f7e6d8ac1", "1595152772835-219674b2a8a6", "1581382575275-97901c2635b7",
     "1527980965255-d3b416303d12", "1503443207922-dff7d543fd0e", "1517070208541-6ddc4d3efbcb", "1513956589380-bad6acb9b9d4",
     "1536766820879-059fec98ec0a", "1512316609839-ce289d3eba0a", "1522075469751-3a6694fb2f61"]

CITY = {
    "New York": (40.7128, -74.0060), "Los Angeles": (34.0522, -118.2437), "London": (51.5074, -0.1278),
    "Toronto": (43.6532, -79.3832), "Mumbai": (19.0760, 72.8777), "Delhi": (28.6139, 77.2090),
    "Bangalore": (12.9716, 77.5946), "Berlin": (52.5200, 13.4050), "Sydney": (-33.8688, 151.2093),
    "Dubai": (25.2048, 55.2708), "Paris": (48.8566, 2.3522), "Singapore": (1.3521, 103.8198),
    "Pune": (18.5204, 73.8567), "Hyderabad": (17.3850, 78.4867), "Chicago": (41.8781, -87.6298),
}

# What each sample person does (shown under their name on Explore "Suggested for you"), by PEOPLE index.
JOBS = ["Film student", "Marathon runner", "Software engineer", "Product Designer", "Poet & writer", "Photographer",
        "Content creator", "Graphic Designer", "Architect", "Music producer", "Chef", "Fitness coach",
        "Illustrator", "Data analyst", "Fashion stylist", "Medical student", "Founder", "Barista",
        "UX researcher", "Travel blogger", "Dancer", "Game developer", "Journalist", "Interior designer"]

# name, age, gender, looking_for, city, interests, bio, prompts[(q, a)]
PEOPLE = [
    ("Aanya", 21, "woman", "men", "Mumbai", ["Matcha", "Photography", "Indie", "Thrifting", "Sunsets"],
     "Film student who takes too many photos of the sky. Will judge your playlist (lovingly).",
     [("A perfect Sunday looks like", "Marine Drive at 6am, filter coffee, and zero plans after."),
      ("I'm weirdly good at", "Guessing the ending of any movie in the first ten minutes.")]),
    ("Zoe", 23, "woman", "everyone", "New York", ["Running", "Coffee", "Museums", "Podcasts", "Dogs"],
     "Brooklyn by way of Ohio. Training for a half marathon I signed up for at 2am.",
     [("Green flag I look for", "You text back like a normal person."),
      ("My simple pleasures", "The first sip of an iced latte when it's already too cold outside.")]),
    ("Maya", 20, "woman", "men", "Bangalore", ["Coding", "Anime", "Board games", "Street food", "Cats"],
     "CS major, cat mom, unbeatable at Catan. Looking for a co-op partner, in games and otherwise.",
     [("I geek out on", "Mechanical keyboards. Yes I will let you try mine."),
      ("Unpopular opinion", "Dosa is the superior breakfast and it's not close.")]),
    ("Lena", 25, "woman", "everyone", "Berlin", ["Techno", "Art", "Cycling", "Vegan", "Design"],
     "Product designer. I'll take you to a gallery and then a club, in that order.",
     [("Dating me is like", "A very long walk that ends at the best doner in the city."),
      ("My current obsession", "Restoring a 90s road bike I found on eBay.")]),
    ("Priya", 22, "woman", "men", "Delhi", ["Poetry", "Chai", "Live gigs", "Reading", "Dancing"],
     "Literature grad, part-time poet, full-time chai snob.",
     [("The way to win me over is", "Recommend a book and actually explain why."),
      ("My go-to karaoke song is", "Anything Arijit. I will cry. It's part of the experience.")]),
    ("Sofia", 24, "woman", "everyone", "Los Angeles", ["Yoga", "Beach days", "Film", "Plants", "Cooking"],
     "Editor by day, plant mom by night. My monstera is thriving, ask me how.",
     [("Best travel story", "Missed a train in Lisbon, ended up at a rooftop party until sunrise."),
      ("I'll fall for you if", "You make breakfast without being asked.")]),
    ("Nora", 27, "woman", "men", "London", ["Hiking", "Photography", "Coffee", "Travel", "Podcasts"],
     "Camden based. Weekend hiker, weekday spreadsheet wizard.",
     [("Two truths and a lie", "I've run a marathon. I've met Stormzy. I hate marmite."),
      ("Let's debate this", "Is a scotch egg a meal or a snack?")]),
    ("Ishita", 19, "woman", "men", "Pune", ["K-pop", "Baking", "Sitcoms", "Fashion", "Memes"],
     "First year, chronically online, bakes when stressed (so, often).",
     [("The last thing that made me laugh", "My roommate trying to explain finance to our cat."),
      ("My current obsession", "Perfecting a Basque cheesecake. Still not there.")]),
    ("Chloe", 26, "woman", "everyone", "Toronto", ["Gym", "Basketball", "Hip-hop", "Sneakers", "Tattoos"],
     "Nurse. Raptors fan. Sneaker collection is getting out of hand.",
     [("I'm weirdly good at", "Parallel parking on the first try, every time."),
      ("Green flag I look for", "You're kind to servers.")]),
    ("Riya", 23, "woman", "men", "Hyderabad", ["Startups", "Cricket", "Coffee", "Travel", "Tech"],
     "Building something at a startup, watching cricket on the side. Biryani connoisseur.",
     [("Unpopular opinion", "Hyderabadi biryani doesn't need a debate. It just wins."),
      ("A perfect Sunday looks like", "Long drive, longer brunch, nap.")]),
    ("Emma", 22, "woman", "men", "Sydney", ["Swimming", "Beach days", "Sunsets", "Indie", "Dogs"],
     "Ocean swimmer. Dog walker. Sunset chaser. Basically a golden retriever in human form.",
     [("My simple pleasures", "Salty hair, warm fish and chips, a good sunset."),
      ("I geek out on", "Surf forecasts. I can read a swell chart better than a menu.")]),
    ("Hana", 28, "woman", "everyone", "Paris", ["Film", "Museums", "Baking", "Reading", "Art"],
     "Pastry chef. Yes, I'll bring croissants. No, you can't have the recipe.",
     [("Dating me is like", "A slow Sunday market with excellent snacks."),
      ("Best travel story", "Got adopted by a Sicilian grandmother for a week. Still text her.")]),
    ("Arjun", 24, "man", "women", "Mumbai", ["Cricket", "Hip-hop", "Gym", "Street food", "Travel"],
     "Product guy, gym rat, vada pav evangelist. Will plan the whole trip.",
     [("The way to win me over is", "Beat me at FIFA. Or at least try."),
      ("My simple pleasures", "Late night drives on the sea link with the windows down.")]),
    ("Leo", 25, "man", "everyone", "New York", ["Music", "Live gigs", "Coffee", "Skateboarding", "Photography"],
     "Sound engineer. I'll show you my favorite dive bar and the best dollar slice.",
     [("I geek out on", "Vinyl pressings. I have opinions about mastering."),
      ("Unpopular opinion", "Live albums are better than studio albums.")]),
    ("Kabir", 22, "man", "women", "Delhi", ["Football", "Memes", "Gaming", "Podcasts", "Coffee"],
     "Engineering student. Arsenal supporter (it's been hard). Decent cook, great taste in memes.",
     [("Two truths and a lie", "I've been on TV. I can juggle. I've never had Maggi."),
      ("Green flag I look for", "You laugh at your own jokes.")]),
    ("Noah", 27, "man", "women", "London", ["Running", "Cooking", "Reading", "Cycling", "Coffee"],
     "Architect who runs to justify pastries. Looking for someone to split a sourdough with.",
     [("A perfect Sunday looks like", "10k in the morning, roast in the afternoon, nothing after."),
      ("I'm weirdly good at", "Remembering how everyone takes their coffee.")]),
    ("Rohan", 21, "man", "women", "Bangalore", ["Coding", "Startups", "Anime", "Tech", "Board games"],
     "Building an app nobody asked for. Loves anime, rooftop cafes and Uno with strict rules.",
     [("My current obsession", "Learning to make a proper filter coffee at home."),
      ("Let's debate this", "Sub vs dub. I'm ready.")]),
    ("Mateo", 26, "man", "everyone", "Los Angeles", ["Surfing", "Film", "Tacos", "Music", "Hiking"],
     "Filmmaker, surfer, taco truck cartographer.",
     [("Best travel story", "Slept on a beach in Oaxaca because I missed the last bus. Zero regrets."),
      ("Dating me is like", "A road trip with a suspiciously good playlist.")]),
    ("Ethan", 23, "man", "women", "Toronto", ["Basketball", "Gym", "Hip-hop", "Cooking", "Dogs"],
     "Kinesiology grad, part-time trainer. My dog is the main character.",
     [("The last thing that made me laugh", "My dog barking at his own reflection for ten minutes."),
      ("I'll fall for you if", "You can out-eat me at a Korean BBQ.")]),
    ("Dev", 29, "man", "women", "Hyderabad", ["Photography", "Travel", "Coffee", "Cars", "Film"],
     "Photographer. I chase light and good chai. Will take your photos, no charge.",
     [("My simple pleasures", "Golden hour with a camera and no destination."),
      ("Unpopular opinion", "Manual cars are worth the traffic.")]),
    ("Jonas", 24, "man", "everyone", "Berlin", ["Techno", "Design", "Vegan", "Cycling", "Art"],
     "Graphic designer. Yes I'll critique your font choice. Lovingly.",
     [("I geek out on", "Typography. Kerning keeps me up at night."),
      ("A perfect Sunday looks like", "Flea market, then a lake, then a very long dinner.")]),
    ("Omar", 25, "man", "women", "Dubai", ["Football", "Cars", "Gym", "Travel", "Coffee"],
     "Consultant by weekday, desert camper by weekend.",
     [("Best travel story", "Drove Muscat to Dubai with no plan and made three friends for life."),
      ("Green flag I look for", "You're on time.")]),
    ("Sam", 23, "nonbinary", "everyone", "Chicago", ["Art", "Poetry", "Live gigs", "Thrifting", "Cats"],
     "Illustrator. Thrift store archaeologist. Will draw you if you sit still.",
     [("My current obsession", "Risograph printing. Everything is slightly off-register and perfect."),
      ("The way to win me over is", "Send me a song and tell me where you first heard it.")]),
    ("Ren", 26, "nonbinary", "everyone", "Singapore", ["Gaming", "Anime", "Matcha", "Design", "Photography"],
     "UX designer. Matcha over coffee, fight me. Casual gamer, serious about snacks.",
     [("Unpopular opinion", "Mobile games can be art."),
      ("My simple pleasures", "A rainy afternoon and a very long game session.")]),
]


def birthday_for(age: int, salt: int) -> str:
    today = date.today()
    d = today.replace(year=today.year - age) - timedelta(days=30 + (salt * 37) % 300)
    return d.isoformat()


async def clear():
    seeds = await db.users.find({"is_seed": True}, {"_id": 0, "id": 1}).to_list(None)
    ids = [s["id"] for s in seeds]
    await db.swipes.delete_many({"$or": [{"from_id": {"$in": ids}}, {"to_id": {"$in": ids}}]})
    matches = await db.matches.find({"users": {"$in": ids}}, {"_id": 0, "id": 1}).to_list(None)
    await db.messages.delete_many({"match_id": {"$in": [m["id"] for m in matches]}})
    await db.matches.delete_many({"users": {"$in": ids}})
    await db.users.delete_many({"is_seed": True})
    print(f"Removed {len(ids)} sample profiles")


async def seed(likes_for: str = None):
    wi, mi = 0, 0
    created = 0
    for idx, (name, age, gender, looking, city, interests, bio, prompts) in enumerate(PEOPLE):
        if gender == "woman":
            photos = [U.format(W[wi % len(W)]), U.format(W[(wi + 1) % len(W)])]
            wi += 2
        else:
            photos = [U.format(M[mi % len(M)]), U.format(M[(mi + 1) % len(M)])]
            mi += 2
        lat, lng = CITY[city]
        phone = f"+1999000{idx:04d}"
        doc = {
            "phone": phone, "name": name, "birthday": birthday_for(age, idx), "gender": gender, "looking_for": looking,
            "bio": bio, "job": JOBS[idx % len(JOBS)], "interests": interests, "prompts": [{"question": q, "answer": a} for q, a in prompts],
            "city": city, "lat": lat + (idx % 5) * 0.01, "lng": lng + (idx % 3) * 0.01, "photos": photos,
            "preferences": {"age_min": 18, "age_max": 45, "max_distance_km": ANYWHERE_KM, "show_me": looking},
            "is_seed": True, "onboarded": True, "last_active": now_iso(), "updated_at": now_iso(),
        }
        doc["profile_complete"] = is_profile_complete(doc)
        existing = await db.users.find_one({"phone": phone}, {"_id": 0, "id": 1})
        if existing:
            await db.users.update_one({"phone": phone}, {"$set": doc})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now_iso()
            await db.users.insert_one(doc)
            created += 1
    print(f"Sample profiles ready: {len(PEOPLE)} total, {created} new")

    if likes_for:
        target = await db.users.find_one({"phone": likes_for}, {"_id": 0})
        if not target:
            print(f"No account with phone {likes_for}")
            return
        seeds = await db.users.find({"is_seed": True}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
        picked = seeds[1:13:2]
        for i, s in enumerate(picked):
            await db.swipes.update_one({"from_id": s["id"], "to_id": target["id"]},
                                       {"$set": {"from_id": s["id"], "to_id": target["id"],
                                                 "action": "superlike" if i == 0 else "like", "created_at": now_iso()},
                                        "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)
        print(f"{len(picked)} sample profiles now like {target.get('name') or likes_for}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--clear" in args:
        asyncio.run(clear())
    else:
        lf = None
        if "--likes-for" in args:
            lf = args[args.index("--likes-for") + 1]
        asyncio.run(seed(lf))
