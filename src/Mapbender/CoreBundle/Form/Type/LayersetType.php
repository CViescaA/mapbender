<?php

namespace Mapbender\CoreBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;

class LayersetType extends AbstractType
{

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {

        $builder
            ->add('title', 'Symfony\Component\Form\Extension\Core\Type\TextType', array(
                'attr' => array(
                    'maxlength' => 128,
                ),
            ))
        ;
    }
}

