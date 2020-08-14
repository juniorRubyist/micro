import auth from '../../../utils/auth'
import { v4 as uuid } from 'uuid'
import db from '../../../db'
import config from '../../../config'
import axios from 'axios'

const {
  CONTENT_SCORE_URI,
  CONTENT_SCORE_SECRET,
  NEXUS_URI,
  NEXUS_ID,
  NEXUS_SECRET
} = process.env

export default async (req, res) => {
  const user = await auth(req.cookies.sessionToken)
  if (!user) return res.status(401).send({ err: 'badAuthorization' })

  const { content, parent: parentId } = req.body
  if (typeof content !== 'string') return res.status(400).json({ err: 'badRequest' })
  if (
    content.length < 1 ||
    content.length > config.maxPostLength
  ) return res.status(400).json({ err: 'micro.post.length' })

  // Verify Parent
  let parent
  if (typeof parentId === 'string') {
    parent = await db.Post.findOne({
      where: {
        id: parentId
      }
    })
    if (!parent) return res.status(400).json({ err: 'micro.post.parent' })
  }

  // Content score
  let score = 0
  try {
    score = (await axios.post(
      CONTENT_SCORE_URI,
      { content },
      {
        headers: {
          authorization: CONTENT_SCORE_SECRET
        }
      }
    )).data
  } catch (err) {}

  // Update reputation
  try {
    await axios.post(
      `${NEXUS_URI}/users/${user.id}/reputation`,
      { score },
      {
        auth: {
          username: NEXUS_ID,
          password: NEXUS_SECRET
        }
      }
    )
  } catch (err) { console.log(err) }

  // Create post
  const post = await db.Post.create({
    id: uuid(),
    author: user.id,
    alles: true,
    content,
    score,
    parentId: parent ? parent.id : null
  })

  // Upvote post
  await db.Interaction.create({
    id: uuid(),
    user: user.id,
    postId: post.id,
    vote: 'up'
  })

  // Response
  res.json({ id: post.id })
}
