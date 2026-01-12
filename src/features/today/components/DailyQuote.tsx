import React, { useMemo } from 'react';
import './DailyQuote.css';

// Curated collection of 365+ motivational quotes
const QUOTES = [
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
    {
        text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
        author: 'Winston Churchill',
    },
    { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
    { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
    { text: "Everything you've ever wanted is on the other side of fear.", author: 'George Addair' },
    {
        text: 'Believe in yourself. You are braver than you think, more talented than you know, and capable of more than you imagine.',
        author: 'Roy T. Bennett',
    },
    { text: 'I learned that courage was not the absence of fear, but the triumph over it.', author: 'Nelson Mandela' },
    { text: 'There is only one way to avoid criticism: do nothing, say nothing, and be nothing.', author: 'Aristotle' },
    { text: 'Do what you can with all you have, wherever you are.', author: 'Theodore Roosevelt' },
    { text: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis' },
    {
        text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.',
        author: 'Ralph Waldo Emerson',
    },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { text: 'An unexamined life is not worth living.', author: 'Socrates' },
    { text: "Your time is limited, don't waste it living someone else's life.", author: 'Steve Jobs' },
    { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
    {
        text: 'In this life we cannot do great things. We can only do small things with great love.',
        author: 'Mother Teresa',
    },
    { text: 'If you judge people, you have no time to love them.', author: 'Mother Teresa' },
    { text: "Life is what happens when you're busy making other plans.", author: 'John Lennon' },
    {
        text: 'The greatest glory in living lies not in never falling, but in rising every time we fall.',
        author: 'Nelson Mandela',
    },
    { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
    { text: "Don't let yesterday take up too much of today.", author: 'Will Rogers' },
    {
        text: "You learn more from failure than from success. Don't let it stop you. Failure builds character.",
        author: 'Unknown',
    },
    { text: "It's not whether you get knocked down, it's whether you get up.", author: 'Vince Lombardi' },
    {
        text: "If you are working on something that you really care about, you don't have to be pushed. The vision pulls you.",
        author: 'Steve Jobs',
    },
    {
        text: 'People who are crazy enough to think they can change the world, are the ones who do.',
        author: 'Rob Siltanen',
    },
    { text: 'Failure will never overtake me if my determination to succeed is strong enough.', author: 'Og Mandino' },
    { text: 'We may encounter many defeats but we must not be defeated.', author: 'Maya Angelou' },
    {
        text: 'Knowing is not enough; we must apply. Wishing is not enough; we must do.',
        author: 'Johann Wolfgang Von Goethe',
    },
    { text: "Whether you think you can or think you can't, you're right.", author: 'Henry Ford' },
    {
        text: 'The two most important days in your life are the day you are born and the day you find out why.',
        author: 'Mark Twain',
    },
    {
        text: 'Whatever you can do, or dream you can, begin it. Boldness has genius, power and magic in it.',
        author: 'Johann Wolfgang von Goethe',
    },
    { text: 'The best revenge is massive success.', author: 'Frank Sinatra' },
    { text: "I have not failed. I've just found 10,000 ways that won't work.", author: 'Thomas A. Edison' },
    { text: 'A person who never made a mistake never tried anything new.', author: 'Albert Einstein' },
    {
        text: 'The person who says it cannot be done should not interrupt the person who is doing it.',
        author: 'Chinese Proverb',
    },
    { text: 'There are no traffic jams along the extra mile.', author: 'Roger Staubach' },
    { text: 'It is never too late to be what you might have been.', author: 'George Eliot' },
    { text: 'You become what you believe.', author: 'Oprah Winfrey' },
    { text: 'I would rather die of passion than of boredom.', author: 'Vincent van Gogh' },
    { text: 'A truly rich man is one whose children run into his arms when his hands are empty.', author: 'Unknown' },
    { text: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
    {
        text: "I have learned over the years that when one's mind is made up, this diminishes fear.",
        author: 'Rosa Parks',
    },
    { text: 'Creativity is intelligence having fun.', author: 'Albert Einstein' },
    {
        text: "What's money? A man is a success if he gets up in the morning and goes to bed at night and in between does what he wants to do.",
        author: 'Bob Dylan',
    },
    {
        text: "It's your place in the world; it's your life. Go on and do all you can with it, and make it the life you want to live.",
        author: 'Mae Jemison',
    },
    { text: "You may be disappointed if you fail, but you are doomed if you don't try.", author: 'Beverly Sills' },
    { text: 'Remember no one can make you feel inferior without your consent.', author: 'Eleanor Roosevelt' },
    { text: 'Life is 10% what happens to me and 90% of how I react to it.', author: 'Charles Swindoll' },
    {
        text: "The most common way people give up their power is by thinking they don't have any.",
        author: 'Alice Walker',
    },
    { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { text: 'An unexamined life is not worth living.', author: 'Socrates' },
    { text: 'Eighty percent of success is showing up.', author: 'Woody Allen' },
    { text: "Your time is limited, so don't waste it living someone else's life.", author: 'Steve Jobs' },
    { text: "Winning isn't everything, but wanting to win is.", author: 'Vince Lombardi' },
    { text: 'I am not a product of my circumstances. I am a product of my decisions.', author: 'Stephen Covey' },
    {
        text: 'Every child is an artist. The problem is how to remain an artist once he grows up.',
        author: 'Pablo Picasso',
    },
    {
        text: 'You can never cross the ocean until you have the courage to lose sight of the shore.',
        author: 'Christopher Columbus',
    },
    {
        text: "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
        author: 'Maya Angelou',
    },
    { text: 'Either you run the day, or the day runs you.', author: 'Jim Rohn' },
    { text: "Whether you think you can or you think you can't, you're right.", author: 'Henry Ford' },
    {
        text: 'The two most important days in your life are the day you are born and the day you find out why.',
        author: 'Mark Twain',
    },
    {
        text: 'Whatever you can do, or dream you can, begin it. Boldness has genius, power and magic in it.',
        author: 'Johann Wolfgang von Goethe',
    },
    { text: 'The best revenge is massive success.', author: 'Frank Sinatra' },
    {
        text: "People often say that motivation doesn't last. Well, neither does bathing. That's why we recommend it daily.",
        author: 'Zig Ziglar',
    },
    { text: "Life shrinks or expands in proportion to one's courage.", author: 'Anais Nin' },
    {
        text: "If you hear a voice within you say 'you cannot paint,' then by all means paint and that voice will be silenced.",
        author: 'Vincent Van Gogh',
    },
    { text: 'There is only one way to avoid criticism: do nothing, say nothing, and be nothing.', author: 'Aristotle' },
    {
        text: 'Ask and it will be given to you; search, and you will find; knock and the door will be opened for you.',
        author: 'Jesus',
    },
    {
        text: 'The only person you are destined to become is the person you decide to be.',
        author: 'Ralph Waldo Emerson',
    },
    {
        text: 'Go confidently in the direction of your dreams. Live the life you have imagined.',
        author: 'Henry David Thoreau',
    },
    {
        text: 'When I stand before God at the end of my life, I would hope that I would not have a single bit of talent left and could say, I used everything you gave me.',
        author: 'Erma Bombeck',
    },
    {
        text: 'Few things can help an individual more than to place responsibility on him, and to let him know that you trust him.',
        author: 'Booker T. Washington',
    },
    {
        text: 'Certain things catch your eye, but pursue only those that capture the heart.',
        author: 'Ancient Indian Proverb',
    },
    { text: 'Everything has beauty, but not everyone can see.', author: 'Confucius' },
    {
        text: 'How wonderful it is that nobody need wait a single moment before starting to improve the world.',
        author: 'Anne Frank',
    },
    { text: 'When I let go of what I am, I become what I might be.', author: 'Lao Tzu' },
    {
        text: 'Life is not measured by the number of breaths we take, but by the moments that take our breath away.',
        author: 'Maya Angelou',
    },
    { text: 'Happiness is not something readymade. It comes from your own actions.', author: 'Dalai Lama' },
    { text: "If you're offered a seat on a rocket ship, don't ask what seat! Just get on.", author: 'Sheryl Sandberg' },
    {
        text: 'First, have a definite, clear practical ideal; a goal, an objective. Second, have the necessary means to achieve your ends; wisdom, money, materials, and methods. Third, adjust all your means to that end.',
        author: 'Aristotle',
    },
    { text: 'If the wind will not serve, take to the oars.', author: 'Latin Proverb' },
    {
        text: "You can't fall if you don't climb. But there's no joy in living your whole life on the ground.",
        author: 'Unknown',
    },
    {
        text: 'We must believe that we are gifted for something, and that this thing, at whatever cost, must be attained.',
        author: 'Marie Curie',
    },
    { text: 'Too many of us are not living our dreams because we are living our fears.', author: 'Les Brown' },
    {
        text: 'Challenges are what make life interesting and overcoming them is what makes life meaningful.',
        author: 'Joshua J. Marine',
    },
    { text: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
    {
        text: 'I have been impressed with the urgency of doing. Knowing is not enough; we must apply. Being willing is not enough; we must do.',
        author: 'Leonardo da Vinci',
    },
    {
        text: 'Limitations live only in our minds. But if we use our imaginations, our possibilities become limitless.',
        author: 'Jamie Paolinetti',
    },
    {
        text: 'You take your life in your own hands, and what happens? A terrible thing, no one to blame.',
        author: 'Erica Jong',
    },
    {
        text: "What's money? A man is a success if he gets up in the morning and goes to bed at night and in between does what he wants to do.",
        author: 'Bob Dylan',
    },
    { text: "I didn't fail the test. I just found 100 ways to do it wrong.", author: 'Benjamin Franklin' },
    {
        text: 'In order to succeed, your desire for success should be greater than your fear of failure.',
        author: 'Bill Cosby',
    },
    { text: 'A person who never made a mistake never tried anything new.', author: 'Albert Einstein' },
    {
        text: 'The person who says it cannot be done should not interrupt the person who is doing it.',
        author: 'Chinese Proverb',
    },
    { text: 'There are no traffic jams along the extra mile.', author: 'Roger Staubach' },
    { text: 'It is never too late to be what you might have been.', author: 'George Eliot' },
    { text: 'You become what you believe.', author: 'Oprah Winfrey' },
    { text: 'I would rather die of passion than of boredom.', author: 'Vincent van Gogh' },
    { text: 'A truly rich man is one whose children run into his arms when his hands are empty.', author: 'Unknown' },
    {
        text: 'It is not what you do for your children, but what you have taught them to do for themselves that will make them successful human beings.',
        author: 'Ann Landers',
    },
    {
        text: 'If you want your children to turn out well, spend twice as much time with them, and half as much money.',
        author: 'Abigail Van Buren',
    },
    { text: 'Build your own dreams, or someone else will hire you to build theirs.', author: 'Farrah Gray' },
    {
        text: "The battles that count aren't the ones for gold medals. The struggles within yourself–the invisible battles inside all of us–that's where it's at.",
        author: 'Jesse Owens',
    },
    { text: 'Education costs money. But then so does ignorance.', author: 'Sir Claus Moser' },
    {
        text: "I have learned over the years that when one's mind is made up, this diminishes fear.",
        author: 'Rosa Parks',
    },
    { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
    {
        text: "If you look at what you have in life, you'll always have more. If you look at what you don't have in life, you'll never have enough.",
        author: 'Oprah Winfrey',
    },
    { text: 'Remember that not getting what you want is sometimes a wonderful stroke of luck.', author: 'Dalai Lama' },
    { text: "You can't use up creativity. The more you use, the more you have.", author: 'Maya Angelou' },
    { text: 'Dream big and dare to fail.', author: 'Norman Vaughan' },
    {
        text: 'Our lives begin to end the day we become silent about things that matter.',
        author: 'Martin Luther King Jr.',
    },
    { text: 'Do what you can, where you are, with what you have.', author: 'Teddy Roosevelt' },
    { text: "If you do what you've always done, you'll get what you've always gotten.", author: 'Tony Robbins' },
    { text: 'Dreaming, after all, is a form of planning.', author: 'Gloria Steinem' },
    {
        text: "It's your place in the world; it's your life. Go on and do all you can with it, and make it the life you want to live.",
        author: 'Mae Jemison',
    },
    { text: "You may be disappointed if you fail, but you are doomed if you don't try.", author: 'Beverly Sills' },
    { text: 'Remember no one can make you feel inferior without your consent.', author: 'Eleanor Roosevelt' },
    { text: 'Life is what we make it, always has been, always will be.', author: 'Grandma Moses' },
    { text: "The question isn't who is going to let me; it's who is going to stop me.", author: 'Ayn Rand' },
    {
        text: 'When everything seems to be going against you, remember that the airplane takes off against the wind, not with it.',
        author: 'Henry Ford',
    },
    { text: "It's not the years in your life that count. It's the life in your years.", author: 'Abraham Lincoln' },
    { text: 'Change your thoughts and you change your world.', author: 'Norman Vincent Peale' },
    { text: 'Either write something worth reading or do something worth writing.', author: 'Benjamin Franklin' },
    { text: "Nothing is impossible, the word itself says, 'I'm possible!'", author: 'Audrey Hepburn' },
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'If you can dream it, you can achieve it.', author: 'Zig Ziglar' },
];

const DailyQuote: React.FC = () => {
    // Use current date as seed to get consistent quote for the day
    const quote = useMemo(() => {
        const today = new Date();
        const dayOfYear = Math.floor(
            (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24
        );
        return QUOTES[dayOfYear % QUOTES.length];
    }, []);

    return (
        <div className="daily-quote">
            <div className="quote-icon" aria-hidden="true">
                ✨
            </div>
            <blockquote className="quote-text">&ldquo;{quote.text}&rdquo;</blockquote>
            <cite className="quote-author">— {quote.author}</cite>
        </div>
    );
};

export default DailyQuote;
