export default async function handler(req, res) {

    const username = req.query.username;

    if (!username) {
        return res.status(400).json({
            error: "Username belum diisi."
        });
    }

    try {

        // Cari User ID berdasarkan username
        const userResponse = await fetch(
            "https://users.roblox.com/v1/usernames/users",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    usernames: [username],
                    excludeBannedUsers: false
                })
            }
        );

        if (!userResponse.ok) {
            throw new Error("Roblox API error.");
        }

        const userData = await userResponse.json();

        if (
            !userData.data ||
            userData.data.length === 0
        ) {
            return res.status(404).json({
                error: "Username Roblox tidak ditemukan."
            });
        }

        const user = userData.data[0];
        const id = user.id;

        // Ambil profil
        const profileResponse = await fetch(
            `https://users.roblox.com/v1/users/${id}`
        );

        const profile = await profileResponse.json();

        // Ambil avatar
        const avatarResponse = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`
        );

        const avatarData = await avatarResponse.json();

        const avatar =
            avatarData.data?.[0]?.imageUrl || "";

        // Statistik
        async function count(url) {

            try {

                const response =
                    await fetch(url);

                if (!response.ok)
                    return 0;

                const data =
                    await response.json();

                return data.count || 0;

            } catch {
                return 0;
            }
        }

        const friends = await count(
            `https://friends.roblox.com/v1/users/${id}/friends/count`
        );

        const followers = await count(
            `https://friends.roblox.com/v1/users/${id}/followers/count`
        );

        const following = await count(
            `https://friends.roblox.com/v1/users/${id}/followings/count`
        );

        // Status
        let status = "Offline";

        try {

            const presenceResponse =
                await fetch(
                    "https://presence.roblox.com/v1/presence/users",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            userIds: [id]
                        })
                    }
                );

            const presence =
                await presenceResponse.json();

            const type =
                presence.userPresences?.[0]?.userPresenceType;

            if (type === 2)
                status = "Online";

            else if (type === 1)
                status = "Website";

            else if (type === 3)
                status = "Studio";

        } catch {}

        return res.status(200).json({

            id: id,

            username:
                profile.name || user.name,

            displayName:
                profile.displayName ||
                user.displayName,

            description:
                profile.description || "",

            avatar: avatar,

            friends: friends,

            followers: followers,

            following: following,

            status: status
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: "Gagal mengambil data dari Roblox."
        });

    }
}
